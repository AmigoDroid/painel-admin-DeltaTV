import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
test('cadastro global tem um único destino e mantém o atalho antigo',()=>{
  assert.match(app,/pricing: \["Pacotes de serviço", ServicePackages\]/);
  assert.match(app,/"service-packages": \["Pacotes de serviço", ServicePackages\]/);
  const menu=app.slice(app.indexOf('const GROUPS'),app.indexOf('const ICONS'));
  assert.doesNotMatch(menu,/'pricing'/);
  assert.equal(menu.match(/'service-packages'/g)?.length,1);
});
