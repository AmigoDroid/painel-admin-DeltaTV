import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminPageAllowed, adminScopedView } from '../shared/permissions.js';
const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
test('Badge do admin usa o MESMO componente de Partners e effectiveStatus',()=>{
 const workspace=read('../src/pages/NetworkWorkspace.jsx');
 const superadmin=read('../src/pages/Partners.jsx');
 assert.match(workspace,/import \{ Modal, Badge \} from "\.\.\/ui\.jsx"/);
 assert.match(superadmin,/Badge[^\n]*from "\.\.\/ui\.jsx"/);
 assert.match(workspace,/function PartnerBadge\(\{partner\}\)/);
 assert.match(workspace,/<Badge status=\{partner\.effectiveStatus\}/);
 assert.match(workspace,/<PartnerBadge partner=\{p\}/);
 assert.doesNotMatch(workspace,/<td>\{p\.status\}<\/td>/);
 assert.match(workspace,/status:partnerStatus\|\|undefined/);
});
test('Admin vê apenas lixeira da rede e jamais opções VPS ou plataforma',()=>{
 const user={role:'admin',delegatedPermissions:['network:partners:delete']};
 assert.equal(adminPageAllowed('trash',user),true);
 assert.equal(adminScopedView('trash'),'trash');
 assert.equal(adminPageAllowed('vpsmonitor',user),false);
 assert.equal(adminPageAllowed('vpsfiles',user),false);
 assert.equal(adminPageAllowed('global-config',user),false);
 assert.equal(adminPageAllowed('control',user),false);
 assert.equal(adminPageAllowed('trash',{role:'admin',delegatedPermissions:[]}),false);
});
