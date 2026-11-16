import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {adminPageAllowed} from "../shared/permissions.js";
const src=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("Admin de rede só possui Minha rede e Minha conta; DeltaTV mantém visão total",()=>{
 const admin={role:"admin",id:"a",permissions:["network:partners:read","*"]};
 for(const page of ["vpsmonitor","vpsfiles","dashboard","billing","users","partners","devices","network","global-config","control"])
   assert.equal(adminPageAllowed(page,admin),false,page);
 assert.equal(adminPageAllowed("workspace",admin),true);
 assert.equal(adminPageAllowed("conta",admin),true);
 assert.equal(adminPageAllowed("vpsmonitor",{role:"superadmin",id:"d"}),true);
});
test("painel isolado usa somente /admin/workspace e não mistura consultas globais",()=>{
 const page=src("../src/pages/NetworkWorkspace.jsx");
 assert.match(page,/`\/admin\/workspace\/\$\{path\}`/);
 assert.doesNotMatch(page,/api\("\/admin\/(?:partners|dashboard|service-plans|users)/);
 const shell=src("../src/App.jsx");
 assert.match(shell,/if \(user\.role === "admin"\) return/);
 assert.match(shell,/workspace: \["Minha rede", NetworkWorkspace\]/);
});
