import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/pages/NetworkWorkspace.jsx',import.meta.url),'utf8');
test('cadastro simples mostra nome e-mail senha plano e resumo de benefícios',()=>{
 for(const x of ["field('Nome'","field('E-mail'","field('Senha (mínimo de 12 caracteres)'","field('Plano da conta'",'plan.activationLimit','plan.maxServers','plan.monthlyPriceCents'])assert.ok(src.includes(x),x);
 const form=src.slice(src.indexOf('const renderAccountForm='),src.indexOf('return <div className=\"workspace-admin-page\"'));
 for(const x of ['Nome do usuário','E-mail de contato','Responsável',"field('Mensalidade","field('DNS por código'","field('Ativações'"])assert.ok(!form.includes(x),x);
});
test('convite de rede permite e-mail, plano, compartilhamento e revogação',()=>{
 for(const x of ['Convidar parceiro','Enviar convite','issueInvite','setInviteResult(result)','Copiar link','invitations/${inv.id}/revoke'])assert.ok(src.includes(x),x);
});
