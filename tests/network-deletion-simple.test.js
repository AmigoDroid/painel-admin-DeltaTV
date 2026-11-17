import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../src/pages/NetworkWorkspace.jsx',import.meta.url),'utf8');
const api=readFileSync(new URL('../../backend/src/modules/admin-workspaces/workspace.routes.js',import.meta.url),'utf8');
test('Excluir não exige digitar nomes ou e-mails nos formulários de gestão da rede',()=>{
  assert.doesNotMatch(ui,/Digite o nome da conta para confirmar|Digite o e-mail para confirmar|Digite exatamente/);
  assert.doesNotMatch(ui,/deleteConfirmation\.trim\(\)!==|userDeleteConfirm\.trim\(\)\.toLowerCase\(\)!==|planDeleteConfirmation!==/);
  assert.match(ui,/Motivo da exclusão \(opcional\)/);
});
test('Backend aceita motivo vazio e confere pertencimento ao titular em cada exclusão',()=>{
  assert.match(api,/router\.delete\("\/plans\/:key"/);
  assert.match(api,/confirmation:p\.name/);
  assert.match(api,/confirmation:code\.code/);
  assert.match(api,/confirmation:provider\.name/);
  assert.match(api,/partnerId:p\.id,deletedAt:null/);
  assert.match(api,/reason:z\.string\(\)\.trim\(\)\.max\(400\)\.optional\(\)\.default\(""\)/);
});
