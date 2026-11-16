import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {adminPageAllowed,adminScopedView} from "../shared/permissions.js";
const src=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const granted=["network:dashboard:read","network:partners:read","network:resellers:read",
  "network:plans:read","network:members:read","network:resources:read","network:devices:read","network:billing:read"];

test("Admin autorizado vê as mesmas seções delegáveis, sem acesso global ou à VPS",()=>{
 const admin={role:"admin",id:"a",delegatedPermissions:granted};
 for(const page of ["dashboard","workspace","partners","resellers","pricing","users","sources","devices","billing","conta"])
   assert.equal(adminPageAllowed(page,admin),true,page);
 for(const page of ["vpsmonitor","vpsfiles","control","global-config","audit","gateways","webaccess","whiteLabel"])
   assert.equal(adminPageAllowed(page,admin),false,page);
 assert.equal(adminPageAllowed("vpsmonitor",{role:"superadmin",id:"d"}),true);
});
test("Permissão revogada oculta seu módulo de imediato",()=>{
 const admin={role:"admin",id:"a",delegatedPermissions:["network:partners:read"]};
 assert.equal(adminPageAllowed("partners",admin),true);
 for(const page of ["billing","users","devices","pricing","sources","resellers"])
   assert.equal(adminPageAllowed(page,admin),false,page);
 assert.equal(adminPageAllowed("workspace",admin),true);
 assert.equal(adminPageAllowed("conta",admin),true);
});
test("Espelho do Admin usa apenas módulos isolados e mantém backend global bloqueado",()=>{
 const app=src("../src/App.jsx");
 const workspace=src("../src/pages/NetworkWorkspace.jsx");
 const backend=src("../../backend/src/modules/admin.routes.js");
 assert.match(app,/adminScopedView\(page\)/);
 assert.match(app,/<NetworkWorkspace key=\{page\} section=\{adminView/);
 assert.match(workspace,/`\/admin\/workspace\/\$\{path\}`/);
 assert.match(backend,/ADMIN_WORKSPACE_ONLY/);
 assert.match(backend,/!\/\^\\\/workspace/);
 assert.equal(adminScopedView("devices"),"devices");
 assert.equal(adminScopedView("global-config"),null);
});
