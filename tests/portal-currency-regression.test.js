import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatBRL} from '../shared/ui/src/money.js';
const read=rel=>readFileSync(new URL(`../src/pages/${rel}`,import.meta.url),'utf8');
test('preços e cobranças em centavos são exibidos corretamente no Painel DeltaTV',()=>{
 assert.equal(formatBRL(15000).replace(/\u00a0/g,' '),'R$ 150,00');
 for(const filename of ['PortalSales.jsx','ServicePackages.jsx','PortalUsage.jsx']){
  const source=read(filename);
  assert.match(source,/import \{formatBRL\} from ['"]@deltatv\/ui\/money['"]/);
  assert.doesNotMatch(source,/Number\([^\n]{0,50}\)\.toLocaleString\('pt-BR',\{style:'currency'/);
 }
 assert.match(read('PortalSales.jsx'),/const money=formatBRL/);
 assert.match(read('ServicePackages.jsx'),/const money=formatBRL/);
 assert.match(read('PortalUsage.jsx'),/formatBRL\(v\)/);
});
