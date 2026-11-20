import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const detail = readFileSync(new URL("../src/pages/PartnerDetailModal.jsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../../backend/src/modules/admin-workspaces/workspace.routes.js", import.meta.url), "utf8");
const provisioning = readFileSync(new URL("../../backend/src/modules/admin-workspaces/account-provisioning.js", import.meta.url), "utf8");

test("seletor de planos da ficha respeita a compatibilidade exigida pela API", () => {
  assert.match(detail, /plan\.audience===partner\.kind\|\|plan\.audience==="both"/);
  assert.doesNotMatch(detail, /\|\|partner\.kind==="both"/);
  assert.match(provisioning, /plan\.audience==='both'\|\|plan\.audience===kind/);
  assert.match(routes, /scopedPlan\(root,b\.planKey,p\.kind,t\)/);
});

test("trocar plano não reenvia vencimento quando não foi alterado", () => {
  assert.match(detail, /const originalEndsAt=partner\.endsAt/);
  assert.match(detail, /form\.endsAt&&form\.endsAt!==originalEndsAt/);
  assert.match(routes, /b\.endsAt && b\.endsAt<=p\.startsAt/);
});
