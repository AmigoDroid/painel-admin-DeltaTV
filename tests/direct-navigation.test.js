import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');

test('Admin: menu lateral único e direto, sem sub-dashboards', () => {
  const app = read('../src/App.jsx');
  assert.doesNotMatch(app, /import WorkArea/);
  assert.doesNotMatch(app, /Dashboards/);
  assert.doesNotMatch(app, /sidebar-all-functions/);
  assert.match(app, /GROUPS\.map\(renderMenuGroup\)/);
  // Nenhuma função fica escondida por "modo simples" no menu.
  assert.match(app, /g\.items\.filter\(allowed\)/);
});

test('Admin: painel inicial mostra todas as funções permitidas e abre direto', () => {
  const app = read('../src/App.jsx');
  const dash = read('../src/pages/Dashboard.jsx');
  assert.match(app, /homeGroups/);
  assert.match(app, /allowed\(k\)/);
  assert.match(dash, /<AllFunctions groups=\{menu\} onNavigate=\{onNavigate\}/);
  assert.doesNotMatch(dash, /href=\{'#'\+id\} className="dw-home-hub"/);
  const comp = read('../src/AllFunctions.jsx');
  assert.match(comp, /onNavigate\(item\.id\)/);
});
