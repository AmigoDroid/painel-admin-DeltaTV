import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/pages/help-management.css', import.meta.url), 'utf8');
test('editor de tutoriais do Superadmin ocupa tela móvel com formulário rolável e rodapé acessível', () => {
  assert.match(css, /\.hm15-editor\s*\{\s*width:100%;max-height:100dvh;height:100dvh/);
  assert.match(css, /\.hm15-editor-scroll\s*\{\s*flex:1;overflow-y:auto/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.hm15-form-grid\s*\{\s*grid-template-columns:minmax\(0,1fr\)/);
});
