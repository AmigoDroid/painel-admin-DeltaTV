import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/pages/HelpManagement.jsx',import.meta.url),'utf8');
test('editor permite configurar confirmação e tutorial externo Roku',()=>{
 assert.match(page,/Como conferir que a etapa foi realizada/);
 assert.match(page,/Na TV \/ celular/);
 assert.match(page,/context-help/);
 assert.match(page,/"mode"/);
});
