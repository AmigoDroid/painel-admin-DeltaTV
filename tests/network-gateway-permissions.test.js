import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adminPageAllowed, toggleDelegatedPermission} from '../shared/permissions.js';

test('selecionar Configurar Pix inclui Ver gateways; desmarcar leitura também remove escrita',()=>{
  assert.deepEqual(toggleDelegatedPermission([], 'network:gateways:write', true).sort(),
    ['network:gateways:read','network:gateways:write']);
  assert.deepEqual(toggleDelegatedPermission(['network:gateways:read','network:gateways:write'], 'network:gateways:read', false), []);
  assert.deepEqual(toggleDelegatedPermission(['network:gateways:read','network:gateways:write'], 'network:gateways:write', false), ['network:gateways:read']);
});

test('financeiro aceita escrita de gateway, mas nunca abre recursos globais',()=>{
  const admin={id:'a',role:'admin',delegatedPermissions:['network:gateways:write']};
  assert.equal(adminPageAllowed('network-finance',admin),true);
  assert.equal(adminPageAllowed('global-config',admin),false);
  assert.equal(adminPageAllowed('vpsmonitor',admin),false);
  assert.equal(adminPageAllowed('finance-networks',admin),false);
});

test('painel consulta as permissões do perfil autenticado, sem conceder permissões pelo cliente',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  const profile=readFileSync(new URL('../../backend/src/modules/profile/profile.routes.js',import.meta.url),'utf8');
  const gateways=readFileSync(new URL('../src/pages/NetworkFinance.jsx',import.meta.url),'utf8');
  assert.match(app,/api\("\/auth\/profile"\)/);
  assert.match(app,/updateAuthUser\(\{ id: user\.id, delegatedPermissions: user\.delegatedPermissions \}\)/);
  assert.match(profile,/req\.user\.role === "admin" \? \{delegatedPermissions: req\.user\.delegatedPermissions\}/);
  assert.match(gateways,/network:gateways:write/);
  assert.match(gateways,/role="status">Para visualizar e configurar Mercado Pago ou InfinitePay/);
});
