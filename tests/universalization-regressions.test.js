import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');

test('planos usam campos técnicos e visibilidade num único componente compartilhado',()=>{
  const common = read('pages/PlanCommonFields.jsx');
  const workspace = read('pages/NetworkWorkspace.jsx');
  const global = read('pages/PlansAndPricing.jsx');
  for (const page of [workspace,global]) {
    assert.match(page,/import \{PlanTechnicalOptions,PlanVisibilityOption\} from "\.\/PlanCommonFields\.jsx"/);
    assert.match(page,/<PlanTechnicalOptions/);
    assert.match(page,/<PlanVisibilityOption/);
    assert.doesNotMatch(page,/\[\["autoFailover","Failover automático"\]/);
  }
  assert.match(common,/disabled=\{key==="autoPriority"&&!plan\.autoFailover\}/);
  assert.match(common,/Ocultar da minha rede/);
});
test('Admin usa tela de planos uma vez e conserva link antigo sem liberar página global',()=>{
  const app=read('App.jsx');
  assert.match(app,/items:\['dashboard','workspace','partners','resellers','pricing','invitations','devices'\]/);
  assert.match(app,/user\.role === "admin" && k === "service-packages"/);
  assert.match(app,/oldId === "service-packages" \? "pricing"/);
  assert.match(app,/items:\['control','ativar-tv','clients','unlinked','credits','network','service-packages'\]/);
});
test('conversão de dinheiro reutiliza centavos inteiros sem Number*100',()=>{
  const workspace=read('pages/NetworkWorkspace.jsx'),portal=read('pages/PortalSales.jsx');
  assert.match(workspace,/import \{toCents,formatBRL\} from "@deltatv\/ui\/money"/);
  assert.match(portal,/import \{formatBRL,toCents\} from '@deltatv\/ui\/money'/);
  assert.doesNotMatch(workspace,/Math\.round\(Number\(String\(value\)/);
  assert.doesNotMatch(portal,/Math\.round\(Number\(String\(s\)/);
  assert.match(portal,/toCents\(priceEdit\.unitPrice\)==null/);
});
test('Central de Suporte mantém API local enquanto a interface é compartilhada',()=>{
  const shared=readFileSync(new URL('../../shared/ui/src/SupportCenter.jsx',import.meta.url),'utf8');
  assert.match(shared,/export default function SupportCenter\(\{ base = '\/partner', api \}\)/);
  for(const file of ['pages/SupportCenter.jsx']) {
    const wrapper=read(file);
    assert.match(wrapper,/from "@deltatv\/ui\/SupportCenter"/);
    assert.match(wrapper,/api=\{api\}/);
  }
  assert.doesNotMatch(shared,/from ['"]\.\.\/api\.js['"]/);
});
