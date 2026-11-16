import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from './read-source.js';
const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');
test('superadmin tem menu, formulário e API de tutoriais', () => {
  const app=read('../src/App.jsx'); const page=read('../src/pages/HelpManagement.jsx');
  assert.match(app, /help: \["Central de Ajuda", HelpManagement\]/);
  const permissions=read('../shared/permissions.js');
  assert.doesNotMatch(permissions, /help:\s*\{permission:/);
  assert.match(permissions, /if \(user\?\.role === "superadmin"\) return true/);
  assert.match(page, /\/admin\/help/);
  for(const name of ['audience','isOnboarding','imageUrl','videoUrl','steps','sortOrder','status'])assert.ok(page.includes(name));
  assert.match(page, /method: "DELETE"/);
});
