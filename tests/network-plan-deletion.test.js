import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=readFileSync(new URL('../../backend/src/modules/admin-workspaces/workspace.routes.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/pages/NetworkWorkspace.jsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../../backend/src/db/migrations/20270103000001-network-plan-deletion.cjs',import.meta.url),'utf8');
test('Admin tem exclusão de planos com preview, titularidade, confirmação e auditoria',()=>{
 assert.match(api,/router\.get\("\/plans\/:key\/deletion-preview"/);
 assert.match(api,/router\.delete\("\/plans\/:key"/);
 assert.match(api,/where:\{key,ownerAdminId:root,deletedAt:null\}/);
 assert.match(api,/confirmation!==plan\.name/);
 assert.match(api,/network\.plan\.delete/);
 assert.match(api,/AdminNetworkInvitation\.update\(\{revokedAt:new Date\(\)\}/);
});
test('Plano excluído não é selecionável, mas mantém histórico quando há vínculos',()=>{
 assert.match(api,/deletedAt:new Date\(\),active:false/);
 assert.match(api,/mode=accounts\|\|invitations\?'archive':'physical'/);
 assert.match(migration,/addColumn\("service_plan_catalogs","deleted_at"/);
 assert.match(ui,/previewPlanDeletion/);
 assert.match(ui,/Confirmar exclusão/);
 assert.match(ui,/planDeleteConfirmation!==deletingPlan\.name/);
});
