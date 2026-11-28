import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adminPageAllowed,adminScopedView} from '../shared/permissions.js';

const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../src/pages/NetworkWorkspace.jsx',import.meta.url),'utf8');

test('parceiros, revendas e planos são entradas próprias do menu lateral para Admin autorizado',()=>{
  assert.match(app,/items:\s*\[['"]dashboard['"],\s*['"]workspace['"],\s*['"]partners['"],\s*['"]resellers['"],\s*['"]service-packages['"]/);
  const user={id:'adm-test',role:'admin',delegatedPermissions:['network:partners:read','network:resellers:read','network:plans:read']};
  for(const [page,view] of [['partners','partners'],['resellers','resellers'],['service-packages','plans']]){
    assert.equal(adminPageAllowed(page,user),true,page);
    assert.equal(adminScopedView(page),view,page);
  }
});

test('Minha rede do Admin é resumo e não duplica abas nem formulários de cadastros',()=>{
  assert.match(workspace,/const showWorkspaceManager=central \|\| section!=="workspace"/);
  assert.match(workspace,/section === "workspace" && !central/);
  assert.match(workspace,/section === "workspace" && central &&/);
  assert.match(workspace,/section !== "dashboard" && section!=="audit" && section!=="trash" && showWorkspaceManager && tab==="plans"/);
  assert.match(workspace,/section !== "dashboard" && section!=="audit" && section!=="trash" && showWorkspaceManager && tab!=="plans"/);
});
