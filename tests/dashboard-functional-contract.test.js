import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORK_AREAS, workAreaPath, findWorkArea, visibleWorkAreaItems, visibleWorkAreaSection } from '../src/work-areas.js';

const file = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const areas = Object.values(WORK_AREAS);
const items = areas.flatMap(area => area.items);
const ids = new Set(items.map(item => item.page));

test('as áreas exibem TODAS as funções para um perfil com permissão total', () => {
  assert.ok(areas.length >= 6);
  assert.ok(items.length >= 20);
  for (const area of areas) {
    const allowed = item => ids.has(item.page);
    const entries = visibleWorkAreaItems(area, allowed);
    assert.equal(entries.length, area.items.length, `Área ${area.label} perdeu funções`);
    assert.ok(entries.length, `${area.label} não pode ficar vazia para quem tem acesso`);
    for (const item of entries) {
      const path = workAreaPath(area, item);
      assert.equal(findWorkArea(path), area, `Rota ${path}`);
      assert.equal(visibleWorkAreaSection(area, path, allowed), item, `Seção ${item.label} não abre`);
      assert.equal(visibleWorkAreaSection(area, path, () => false), null,
        `Seção ${item.label} não pode ser acessada sem autorização`);
    }
    assert.equal(visibleWorkAreaSection(area, area.id, allowed), null,
      'A visão geral não deve abrir outra função automaticamente');
  }
});

test('o filtro recebe o objeto completo, como os verificadores de App/Shell', () => {
  const first = areas[0];
  let inspected = 0;
  const visible = visibleWorkAreaItems(first, item => {
    assert.equal(typeof item, 'object', 'REGRESSÃO: allowed recebeu string, precisa receber item');
    assert.ok(item.page && item.id && item.label);
    inspected += 1;
    return item.page === first.items[0].page;
  });
  assert.equal(inspected, first.items.length);
  assert.ok(visible.some(item => item.id === first.items[0].id));
  const forbidden = first.items.find(item => item.page !== first.items[0].page);
  if (forbidden) assert.equal(visibleWorkAreaSection(first, workAreaPath(first, forbidden),
    item => item.page === first.items[0].page), null);
  assert.deepEqual(visibleWorkAreaItems(first, () => false), []);
  assert.deepEqual(visibleWorkAreaItems(null, () => true), []);
});

test('o componente que desenha o menu usa a MESMA filtragem dos testes', () => {
  const workArea = file('../src/WorkArea.jsx');
  assert.match(workArea, /visibleWorkAreaItems\(area, allowed\)/,
    'O menu precisa utilizar visibleWorkAreaItems(area, allowed)');
  assert.match(workArea, /visibleWorkAreaSection\(area, route, allowed\)/,
    'A seção aberta deve respeitar a mesma autorização');
  assert.doesNotMatch(workArea, /allowed\(item\.page\)/,
    'REGRESSÃO: este callback recebe o item inteiro, NÃO a string item.page');
  assert.match(workArea, /renderPage\(active\)/,
    'A função selecionada precisa renderizar a página operacional original');
  assert.match(workArea, /entries\.map\(/,
    'O menu precisa listar as funções autorizadas');
});

test('os caminhos antigos das páginas não são interceptados pelos dashboards', () => {
  for (const area of areas) for (const item of area.items) {
    assert.equal(findWorkArea(item.page), null, `Página antiga ${item.page} foi interceptada`);
  }
});

test('Admin: todas as páginas cadastradas nos dashboards existem em PAGES', () => {
  const source = file('../src/App.jsx');
  const start = source.indexOf('const PAGES = {');
  const end = source.indexOf('\n};', start);
  assert.ok(start > -1 && end > start);
  const declaration = source.slice(start, end);
  const registered = new Set([...declaration.matchAll(/(?:^|[,\s])(?:"([^"]+)"|([A-Za-z_$][\w$-]*))\s*:\s*\[/gm)]
    .map(match => match[1] || match[2]));
  for (const item of items) assert.ok(registered.has(item.page), `Falta a página ${item.page} no Admin`);
  assert.match(source, /allowed=\{item=>canOpenPage\(item\.page\)\}/);
  assert.match(source, /if \(workArea\) return <WorkArea/);
});
