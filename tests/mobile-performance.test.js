import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRefreshList, canBackgroundRefresh } from '../src/list-refresh-policy.js';
import { labelResponsiveTable } from '../src/responsive-table.js';

test('alteração da saúde dos servidores não recarrega dispositivos, clientes nem faturas', () => {
  for (const path of ['/admin/devices/by-mac','/admin/clients','/admin/billing','/admin/commerce/customers']) {
    assert.equal(shouldRefreshList(path, { type:'changed', topic:'server-health' }), false);
  }
  assert.equal(shouldRefreshList('/admin/partners', { type:'changed', topic:'providers' }), true);
});
test('notificações e presença não disparam refetch de listagens', () => {
  for (const type of ['notification','partner-presence','device-presence']) {
    assert.equal(shouldRefreshList('/admin/devices/by-mac', { type, topic:'devices' }), false);
  }
});
test('mudanças de licenças, dispositivos e clientes invalidam somente áreas relacionadas', () => {
  assert.equal(shouldRefreshList('/admin/devices/by-mac', { type:'changed', topic:'licenses' }), true);
  assert.equal(shouldRefreshList('/admin/devices/by-mac', { type:'changed', topic:'devices' }), true);
  assert.equal(shouldRefreshList('/admin/commerce/customers', { type:'changed', topic:'commerce' }), true);
  assert.equal(shouldRefreshList('/admin/billing', { type:'changed', topic:'pix' }), true);
  assert.equal(shouldRefreshList('/admin/devices/by-mac', { type:'changed', topic:'commerce' }), false);
});
test('requisição lenta ou aba oculta impede atualização passiva sobreposta', () => {
  assert.equal(canBackgroundRefresh({ hidden:true, inFlight:false, now:8000, lastStarted:0 }), false);
  assert.equal(canBackgroundRefresh({ hidden:false, inFlight:true, now:8000, lastStarted:0 }), false);
  assert.equal(canBackgroundRefresh({ hidden:false, inFlight:false, now:2000, lastStarted:0 }), false);
  assert.equal(canBackgroundRefresh({ hidden:false, inFlight:false, now:4000, lastStarted:0 }), true);
});
// Testa a estrutura JSX sem DOM: operação puramente declarativa, sem MutationObserver.
function el(type, props = {}, ...children) { return { type, props:{...props,children:children.length===1?children[0]:children} }; }
const fakeReact = {
  Children: { toArray: xs => (Array.isArray(xs) ? xs : [xs]).flat(Infinity).filter(x=>x !== null && x !== false && x !== undefined), map: (xs,fn) => (Array.isArray(xs) ? xs : [xs]).map(fn) },
  isValidElement: x => Boolean(x && typeof x === 'object' && x.type),
  cloneElement: (x, p, children) => el(x.type, {...x.props,...p}, children),
};
test('rótulo de tabela é aplicado nas células sem manipular o DOM', () => {
  const input = [el('thead',{},el('tr',{},el('th',{},'MAC'),el('th',{},'Ações'))),el('tbody',{},el('tr',{},el('td',{},'AA:BB'),el('td',{},'⋮')))];
  const out = labelResponsiveTable(input, fakeReact);
  const row = out[1].props.children[0];
  assert.equal(row.props.children[0].props['data-label'], 'MAC');
  assert.equal(row.props.children[1].props['data-label'], 'Ações');
});
