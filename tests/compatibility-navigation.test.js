import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORK_AREAS, findWorkArea, workAreaPath } from '../src/work-areas.js';
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');

test('todas as URLs legadas de operações continuam sendo páginas originais', () => {
  for (const area of Object.values(WORK_AREAS)) {
    assert.equal(findWorkArea(area.id), area);
    for (const item of area.items) {
      assert.equal(findWorkArea(item.page), null, `rota original interceptada: ${item.page}`);
      assert.equal(findWorkArea(workAreaPath(area, item)), area);
    }
  }
});

test('nenhuma seção dos dashboards aponta para outra área por acidente', () => {
  for (const area of Object.values(WORK_AREAS)) {
    for (const item of area.items) {
      const path = workAreaPath(area,item);
      assert.ok(path.startsWith(area.id + '/secao/'));
      assert.equal(findWorkArea(path),area);
    }
  }
});

test('acesso direto a todas as funções foi restaurado no menu principal', () => {
  const shell = read('../src/App.jsx');
  // Menu único, como no painel do parceiro: sem grupo "Dashboards" e sem lista recolhível.
  assert.match(shell, /GROUPS\.map\(renderMenuGroup\)/);
  assert.doesNotMatch(shell, /label:'Dashboards'/);
  assert.doesNotMatch(shell, /<details className="sidebar-all-functions"/);
});

test('dashboard consegue abrir a tela original sem prender o usuário', () => {
  const src = read('../src/WorkArea.jsx');
  assert.match(src, /go\(active\.page\)/);
  assert.match(src, /workAreaPath\(area, entry\)/);
  assert.match(src, /Abrir tela original/);
});

test('links anteriores de subseções criadas na etapa passada seguem funcionando', () => {
  for (const area of Object.values(WORK_AREAS)) {
    for(const item of area.items.filter(i => i.id.startsWith('area/')))
      assert.equal(findWorkArea(item.id),area);
  }
});
