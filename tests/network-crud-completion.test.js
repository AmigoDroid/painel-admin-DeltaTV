import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ui=readFileSync(new URL('../src/pages/NetworkWorkspace.jsx',import.meta.url),'utf8');
const api=readFileSync(new URL('../../backend/src/modules/admin-workspaces/workspace.routes.js',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/pages/PartnerDetailModal.jsx',import.meta.url),'utf8');
const deletion=readFileSync(new URL('../src/DeletionDialog.jsx',import.meta.url),'utf8');
const users=readFileSync(new URL('../src/pages/Users.jsx',import.meta.url),'utf8');
test('CRUD operacional de DNS e códigos conectado a endpoints isolados por parceiro',()=>{
  for(const resource of ['providers','codes']){
    assert.match(detail,new RegExp(resource+'\\/'));
    assert.match(api,new RegExp('router\\.delete\\("/partners/:id/'+resource+'/'));
    assert.match(api,new RegExp('router\\.get\\("/partners/:id/'+resource+'/.*deletion-preview'));
  }
  assert.match(detail,/<DeletionDialog scoped=\{scoped\}/);
  assert.match(deletion,/replacementProviderId/);
  assert.match(deletion,/scoped\?\{\}:\{confirmation\}/);
  assert.match(api,/await ownedPartner\(tenant\(req\),req\.valid\.params\.id\)/);
});
test('usuários têm edição e arquivamento com confirmação, plano tem desativação segura',()=>{
  assert.match(users,/function ScopedPortalUsers/);
  assert.match(detail,/<UsersPanel scoped/);
  assert.match(detail,/function WorkspaceArchiveModal/);
  assert.match(api,/router\.delete\("\/partners\/:id\/users\/:userId"/);
  assert.match(api,/tokenVersion:Number\(u\.tokenVersion\|\|0\)\+1/);
  assert.match(ui,/p\.active\?"Desativar":"Reativar"/);
  assert.match(api,/PLAN_IN_USE/);
});
