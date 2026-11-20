import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL(p, import.meta.url),'utf8');
const ui=read('../src/pages/NetworkWorkspace.jsx');
const routes=read('../../backend/src/modules/admin-workspaces/workspace.routes.js');
const perms=read('../../backend/src/modules/admin-workspaces/permissions.js');
test('seção de dispositivos do Admin reutiliza Devices.jsx com escopo',()=>{
 const app=read('../src/App.jsx');
 const devices=read('../src/pages/Devices.jsx');
 assert.match(app,/<Devices key=\{page\} scoped \/>/);
 assert.match(ui,/import Devices from "\.\/Devices\.jsx"/);
 assert.match(ui,/<Devices scoped \/>/);
 assert.match(devices,/scoped \? "\/admin\/workspace\/devices"/);
 assert.doesNotMatch(ui,/&&<NetworkDevices accounts=/);
});
test('ações exigem permissão de escrita e propriedade validada pelo backend',()=>{
 assert.match(perms,/"network:devices:write"/);
 assert.match(routes,/router\.post\("\/partners\/:id\/devices\/:activationId\/:action",requireScope\("network:devices:write"\)/);
 assert.match(routes,/const p=await ownedPartner\(tenant\(req\),req\.valid\.params\.id\);\s*const \{activationId,action\}/);
 assert.match(routes,/scope:\{partnerId:p\.id\}/);
 assert.match(routes,/action:z\.enum\(\["block","unblock","revoke"\]\)/);
});
