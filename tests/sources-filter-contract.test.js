import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(p,import.meta.url),'utf8');
test('Fontes envia busca e filtros como parâmetros paginados à API, nunca filtra só linhas carregadas',()=>{
 const ui=read('../src/pages/Sources.jsx');
 assert.match(ui,/useList\("\/admin\/sources",\s*\{ q: "", scope: "", status: "" \}\)/);
 assert.match(ui,/list\.filter\(\{ q: dq \}\)/);
 assert.match(ui,/list\.filter\(\{ scope: e\.target\.value \}\)/);
 assert.match(ui,/list\.filter\(\{ status: e\.target\.value \}\)/);
 assert.doesNotMatch(ui,/list\.data\.filter\(/);
});
test('Backend aplica busca e filtros no where do SQL antes de contar e paginar',()=>{
 const routes=read('../../backend/src/modules/sources/sources.routes.js');
 const svc=read('../../backend/src/modules/sources/sources.service.js');
 assert.match(routes,/q: z\.string\(\)\.max\(100\)/);
 assert.match(routes,/scope: z\.enum\(\["global", "partner"\]\)/);
 assert.match(routes,/status: z\.enum\(\["active", "disabled"\]\)/);
 assert.match(svc,/if \(scope\) where\.scope = scope/);
 assert.match(svc,/if \(status\) where\.status = status/);
 assert.match(svc,/if \(q\) where\.name = \{ \[Op\.iLike\]: `%\$\{q\}%` \}/);
 assert.match(svc,/ContentSource\.findAndCountAll\(\{\s*where,/);
});
