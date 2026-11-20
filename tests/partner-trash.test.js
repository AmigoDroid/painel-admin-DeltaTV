import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "./read-source.js";
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/pages/PartnerTrash.jsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../../backend/src/modules/partners/partner.routes.js", import.meta.url), "utf8");
const archive = readFileSync(new URL("../../backend/src/modules/admin-deletion.service.js", import.meta.url), "utf8");
const guard = readFileSync(new URL("../../backend/src/db/schema-preflight.js", import.meta.url), "utf8");

test("Lixeira do superadmin permanece global e Admin usa apenas sua rede", () => {
  assert.match(app, /trash: \["Lixeira", PartnerTrash\]/);
  const permissions=readFileSync(new URL("../shared/permissions.js",import.meta.url),"utf8");
  assert.match(permissions, /trash:\s*\{permission:null, view:"trash"\}/);
  assert.match(permissions,/network:partners:delete/);
  const workspace=readFileSync(new URL("../../backend/src/modules/admin-workspaces/workspace.routes.js",import.meta.url),"utf8");
  assert.match(workspace,/ownerAdminId:tenant\(req\),status:'deleted'/);
  assert.doesNotMatch(workspace,/router\.delete\('\/trash\/.*permanent/);
  assert.match(permissions, /if \(user\?\.role === "superadmin"\) return true/);
  assert.match(app, /EXTRA_GROUPS/);
  assert.match(app, /items:\s*\[[^\]]*['"]vpsmonitor['"][^\]]*['"]vpsfiles['"][^\]]*['"]trash['"]/);
});
test("rotas de lixeira exigem override e id validado", () => {
  for (const endpoint of ["/trash", "/trash/:id/preview", "/trash/:id/restore", "/trash/:id/permanent"])
    assert.ok(routes.includes(`router.${endpoint === "/trash/:id/restore" ? "post" : endpoint === "/trash/:id/permanent" ? "delete" : "get"}("${endpoint}", requirePermission("override")`));
  assert.match(routes, /phrase: z\.literal\("EXCLUIR DEFINITIVAMENTE"\)/);
  assert.match(routes, /purgeFinancialHistory: z\.boolean\(\)\.default\(false\)/);
});
test("interface diferencia restauração de eliminação irreversível e lista bloqueios", () => {
  assert.match(ui, /Restaurar cadastro/);
  assert.match(ui, /EXCLUIR DEFINITIVAMENTE/);
  assert.match(ui, /preview\.blockers/);
  assert.match(ui, /financialConsent/);
  assert.match(ui, /hasRestoreSnapshot/);
  assert.match(ui, /pageSize: 20/);
});
test("arquivar fotografa estado antes de desabilitar usuários", () => {
  assert.ok(archive.indexOf("INSERT INTO partner_trash_snapshots") < archive.indexOf("await AdminUser.update({ status: \"disabled\""));
  assert.match(guard, /partner_trash_snapshots/);
});
