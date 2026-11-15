import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {WORK_AREAS,LEGACY_CENTERS,findWorkArea,workAreaPath} from '../src/work-areas.js';
const source=file=>readFileSync(new URL(file,import.meta.url),'utf8');
test('áreas do Admin possuem identificadores únicos e função de navegação íntegra',()=>{
  const areas=Object.values(WORK_AREAS);assert.ok(areas.length>=6);
  const ids=areas.flatMap(a=>a.items.map(i=>i.id));
  assert.equal(new Set(ids).size,ids.length);
  for(const a of areas){assert.ok(a.items.length>0);assert.equal(findWorkArea(a.id),a);
    for(const item of a.items){assert.equal(findWorkArea(workAreaPath(a,item)),a);if(!item.id.startsWith('area/')) assert.equal(findWorkArea(item.id),null);assert.ok(item.page);assert.ok(item.label&&item.description);}}
});
test('operações administrativas importantes seguem disponíveis e não viram atalhos falsos',()=>{
  const pages=Object.values(WORK_AREAS).flatMap(a=>a.items.map(i=>i.page));
  for(const p of ['clients','devices','ativar-tv','resellers','network','commerce3','licenses','pix','billing','servermonitor','audit'])assert.ok(pages.includes(p),p);
  const shell=source('../src/App.jsx');
  assert.match(shell,/if \(workArea\) return <WorkArea/);
  assert.match(shell,/canOpenPage\(item\.page\)/);
  assert.match(shell,/findWorkArea\(page\)/);
  for(const id of Object.keys(WORK_AREAS)) assert.ok(shell.includes('WORK_AREAS'));
  assert.ok(existsSync(new URL('../src/workspace-dashboard.css',import.meta.url)));
});
test('atalhos antigos são enviados aos novos dashboards',()=>{
  assert.equal(LEGACY_CENTERS.pagamentos,'area/financeiro');
  assert.equal(LEGACY_CENTERS.dispositivos,'area/operacao');
  assert.ok(source('../src/App.jsx').includes('LEGACY_CENTERS[raw]'));
});
test('planos, contratos e comissões possuem seções distintas sem duplicar os serviços',()=>{
  const plan=WORK_AREAS['area/planos'];
  assert.equal(plan.items.find(i=>i.id==='commerce3').tab,'plans');
  assert.equal(plan.items.find(i=>i.id==='area/planos/contratos').tab,'contracts');
  assert.equal(WORK_AREAS['area/rede'].items.find(i=>i.id==='area/rede/comissoes').tab,'commissions');
  assert.match(source('../src/pages/Commerce3.jsx'),/visibleTab=activeTab\|\|tab/);
});
