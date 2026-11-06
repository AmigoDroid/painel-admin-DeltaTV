import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const code = readFileSync(new URL("../src/pages/Partners.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const routes = readFileSync(new URL("../../backend/src/modules/partners/partner.routes.js", import.meta.url), "utf8");

test("telas de parceiros e revendas usam o mesmo componente com avatar e iniciais", () => {
  assert.match(code, /function PartnersList\(\{ scope,/);
  assert.match(code, /function Partners\(props\).*scope="content"/);
  assert.match(code, /function Resellers\(props\).*scope="reseller"/);
  assert.match(code, /<PartnerAvatar name=\{p\.name\}/);
  assert.match(code, /avatarData \? <img/);
  assert.match(code, /:\s*<span>\{initials\}<\/span>/);
  assert.match(css, /\.partner-list-avatar img\{[^}]*object-fit:cover/);
});

test("painel só busca imagens ausentes, autentica na API e limita cache", () => {
  assert.match(code, /!avatarCache\.has\(key\)/);
  assert.match(code, /api\("\/admin\/partners\/avatars", \{ method: "POST"/);
  assert.match(code, /while \(next\.size > 100\)/);
  assert.match(code, /\.catch\(\(\) => \{ \/\* A lista continua utilizável/);
  assert.match(routes, /requirePermission\("partners:read"\)/);
});

test("componente usa layout de foto sem desviar o clique da linha", () => {
  assert.match(code, /<tr key=\{p.id\} className="click" onClick=\{\(\) => setOpenId\(p.id\)\}/);
  assert.match(code, /<PartnerAvatar name=\{p.name\} avatarData=/);
  assert.match(code, /loading="lazy" decoding="async"/);
});
