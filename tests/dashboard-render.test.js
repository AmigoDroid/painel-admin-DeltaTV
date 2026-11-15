/**
 * Teste de renderização real (React SSR) quando dependências estão instaladas.
 * Não exige jsdom, navegador, rede ou backend.
 * Em uma instalação limpa, execute npm install antes de npm test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { WORK_AREAS, workAreaPath, visibleWorkAreaItems } from '../src/work-areas.js';

const req = createRequire(import.meta.url);
let React, renderToStaticMarkup, transformSync, jsxRuntime;
try {
  React = req('react');
  renderToStaticMarkup = req('react-dom/server').renderToStaticMarkup;
  transformSync = req('esbuild').transformSync; // dependência transitiva do Vite
  jsxRuntime = req('react/jsx-runtime');
} catch { /* Os testes de contrato sem dependências continuam rodando. */ }

const possible = Boolean(React && renderToStaticMarkup && transformSync && jsxRuntime);

function loadWorkArea() {
  const input = readFileSync(new URL('../src/WorkArea.jsx', import.meta.url), 'utf8');
  const output = transformSync(input, {loader: 'jsx', format: 'cjs', jsx: 'automatic'}).code;
  const mod = {exports: {}};
  const fakeRequire = (id) => {
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id.endsWith('.css')) return {};
    if (id.endsWith('/work-areas.js')) return {workAreaPath, visibleWorkAreaItems,
      visibleWorkAreaSection: (area, route, allowed) => visibleWorkAreaItems(area,allowed)
        .find(item => workAreaPath(area,item) === route || (item.id.startsWith('area/') && item.id === route)) || null};
    throw new Error(`Dependência inesperada: ${id}`);
  };
  const execute = runInNewContext(`(function(require, module, exports) { ${output}\n })`, {});
  execute(fakeRequire, mod, mod.exports);
  return mod.exports.default;
}

test('React renderiza menu e cartões de TODAS as áreas para um usuário autorizado',
  {skip: !possible && 'Execute npm install antes do teste React SSR'}, () => {
    const WorkArea = loadWorkArea();
    for (const area of Object.values(WORK_AREAS)) {
      const props = {area, route: area.id, go: () => {}, back: () => {},
        allowed: item => Boolean(item && typeof item === 'object' && item.page),
        renderPage: () => React.createElement('p', null, 'TELA-OPERACIONAL'),
        renderIcon: () => React.createElement('i', null, 'ícone')};
      const html = renderToStaticMarkup(React.createElement(WorkArea, props));
      assert.match(html.replace(/<!--.*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '),
        new RegExp(`${area.items.length} funções`), `${area.label} exibe 0 funções`);
      for (const entry of area.items) assert.ok(html.includes(entry.label),
        `O menu de ${area.label} não mostra ${entry.label}`);
      const active = renderToStaticMarkup(React.createElement(WorkArea,
        {...props, route: workAreaPath(area, area.items[0])}));
      assert.ok(active.includes('TELA-OPERACIONAL'), `A página real não abre em ${area.label}`);
    }
  });
