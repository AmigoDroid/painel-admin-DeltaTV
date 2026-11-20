import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../src/pages/NetworkWorkspace.jsx',import.meta.url),'utf8');
test('Admin diferencia planos que oferece; Superadmin mantém catálogo global',()=>{
 assert.match(app,/role === "admin" && id === "pricing" \? "Planos que ofereço" : PAGES\[id\]\[0\]/);
 assert.match(app,/label: pageLabel\(k\)/);
 assert.match(workspace,/section==="plans"\?"Planos que ofereço"/);
 assert.match(app,/pricing: \["Planos e recursos", PlansAndPricing\]/);
});
