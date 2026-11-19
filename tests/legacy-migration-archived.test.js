import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = url => readFileSync(new URL(url,import.meta.url),'utf8');

test('Migração de clientes legados fica arquivada e não é navegável no painel admin',()=>{
  const app=load('../src/App.jsx');
  const areas=load('../src/work-areas.js');
  const routes=load('../../backend/src/modules/admin.routes.js');
  assert.doesNotMatch(app,/import LegacyMigration from/);
  assert.doesNotMatch(app,/legados:\s*\[/);
  assert.doesNotMatch(app,/items:\[[^\]]*'legados'/);
  assert.doesNotMatch(areas,/id:'legados'/);
  assert.doesNotMatch(routes,/router\.use\("\/devices\/legacy-migration"/);
  assert.match(load('../src/pages/LegacyMigration.jsx'),/export default function LegacyMigration/);
});
