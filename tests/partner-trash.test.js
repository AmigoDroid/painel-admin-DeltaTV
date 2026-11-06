import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/pages/PartnerTrash.jsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../../backend/src/modules/partners/partner.routes.js", import.meta.url), "utf8");
const archive = readFileSync(new URL("../../backend/src/modules/admin-deletion.service.js", import.meta.url), "utf8");
const guard = readFileSync(new URL("../../backend/src/db/schema-preflight.js", import.meta.url), "utf8");

test("Lixeira aparece no menu só para o superadmin", () => {
  assert.match(app, /trash: \["Lixeira", PartnerTrash\]/);
  assert.match(app, /user\.role !== "superadmin"/);
  assert.match(app, /k === "trash"/);
  assert.match(app, /items: \["vpsmonitor", "trash",/);
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
