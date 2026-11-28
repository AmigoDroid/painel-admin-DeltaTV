import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminPageAllowed } from '../shared/permissions.js';
const src = rel => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

test('DeltaTV visualiza a lista de parceiros no topo do menu e diretamente no Dashboard', () => {
  const app = src('App.jsx');
  const dash = src('pages/Dashboard.jsx');
  assert.match(app, /partners: \["Gerenciar parceiros", Partners\]/);
  assert.match(app, /items:\s*\[['"]dashboard['"],\s*['"]workspace['"],\s*['"]partners['"]/);
  assert.match(dash, /href="#partners"/);
  assert.doesNotMatch(dash, /Abrir lista de parceiros/);
  assert.equal(adminPageAllowed('partners', { id:'1', role:'superadmin' }), true);
});

test('cada parceiro pode ser editado sem depender da tela de detalhes', () => {
  const code = src('pages/Partners.jsx');
  assert.match(code, /setEditingPartner\(p\)/);
  assert.match(code, /<PartnerForm partner=\{editingPartner\}/);
  assert.match(code, /setOpenId\(p\.id\)/);
  assert.match(code, /const updates = \{\}/);
  assert.match(code, /Object\.assign\(body, updates\)/);
});
