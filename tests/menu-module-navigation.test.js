import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
test('Planos e Recursos apresenta catálogo, Pacotes de Serviço mostra editor próprio',()=>{
  assert.match(app,/import PlansAndPricing from "\.\/pages\/PlansAndPricing\.jsx"/);
  assert.match(app,/import ServicePackages from "\.\/pages\/ServicePackages\.jsx"/);
  assert.match(app,/pricing: \["Planos e recursos", PlansAndPricing\]/);
  assert.match(app,/"service-packages": \["Pacotes de serviço", ServicePackages\]/);
  assert.match(app,/items:\['dashboard','workspace','partners','resellers','pricing','service-packages'/);
});
