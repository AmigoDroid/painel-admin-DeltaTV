import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL(p, import.meta.url),'utf8');
const ui=read('../src/pages/NetworkWorkspace.jsx');
const routes=read('../../backend/src/modules/admin-workspaces/workspace.routes.js');
const perms=read('../../backend/src/modules/admin-workspaces/permissions.js');
test('a seção de TVs lista dispositivos reais, e não contas comerciais',()=>{
 assert.match(ui,/section==="devices"&&permits\("network:devices:read"\)&&<NetworkDevices/);
 assert.match(ui,/section!=="invitations"&&section!=="devices"&&section!=="trash"&&<div/);
 assert.match(ui,/request\(`partners\/\$\{accountId\}\/devices`/);
 assert.match(ui,/MAC \/ Dispositivo/);
});
test('ações exigem permissão de escrita e propriedade validada pelo backend',()=>{
 assert.match(perms,/"network:devices:write"/);
 assert.match(routes,/router\.post\("\/partners\/:id\/devices\/:activationId\/:action",requireScope\("network:devices:write"\)/);
 assert.match(routes,/const p=await ownedPartner\(tenant\(req\),req\.valid\.params\.id\);\s*const \{activationId,action\}/);
 assert.match(routes,/scope:\{partnerId:p\.id\}/);
 assert.match(routes,/action:z\.enum\(\["block","unblock","revoke"\]\)/);
});
