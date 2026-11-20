import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminPageAllowed, adminScopedView } from '../shared/permissions.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/ProfilePage.jsx', import.meta.url), 'utf8');

test('Minha conta do Admin abre ProfilePage e não volta para Minha rede', () => {
  assert.match(app, /conta: \["Minha conta", ProfilePage\]/);
  assert.match(app, /onAccount=\{\(\) => go\("conta"\)\}/);
  assert.match(app, /user\.role === "admin" && page !== "downloads" && page !== "conta" \?/);
  assert.match(app, /<Current onChanged=\{refreshCounts\}/);
  assert.match(profile, /SharedProfilePage variant="admin"/);
  assert.equal(adminScopedView('conta'), null);
  assert.equal(adminPageAllowed('conta', { id:'admin-a', role:'admin', delegatedPermissions:[] }), true);
  assert.equal(adminPageAllowed('conta', { id:'admin-s', role:'superadmin' }), true);
});
