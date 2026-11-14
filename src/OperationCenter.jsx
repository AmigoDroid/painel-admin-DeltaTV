import React from 'react';
import './operation-center.css';
import { MasterPixGlobal } from './pages/MasterPixAdmin.jsx';
import { getAuth } from './api.js';
/** Centralização de navegação, sem replicar operações nem contornar permissões. */
export const CENTER_CONFIG = {
  pagamentos: { title: 'Pagamentos', intro: 'Consulte recebimentos, cobranças, Pix e planos no mesmo lugar.', entries: [
    ['billing','Financeiro','Faturas, pagamentos e relatórios'],['pix','Pix','Cobranças e confirmações Pix'],['credits','Créditos','Saldos e movimentações'],['pricing','Planos e valores','Preços e políticas comerciais'],['network','Vendas da rede','Masters e revendas'] ] },
  dispositivos: { title: 'Dispositivos', intro: 'Encontre a TV e acompanhe seu atendimento e configuração.', entries: [
    ['devices','Todas as TVs','Consulte, edite e acompanhe dispositivos'],['unlinked','Aguardando configuração','Dispositivos sem vínculo'],['clients','Clientes','Cadastros relacionados às TVs'],['support','Diagnóstico','Investigue falhas de conexão'] ] },
  licenciamento: { title: 'Licenças', intro: 'Gerencie estoque, licenças e distribuição em um ponto de entrada.', entries: [
    ['licenses','Licenças','Prazos, renovações e estado'],['resellers','Revendas','Quem distribui licenças'],['network','Rede de distribuição','Masters e submasters'],['credits','Créditos','Saldo e distribuição'] ] },
  ativacao: { title: 'Ativar aplicativo', intro: 'Escolha como entregar e configurar o acesso do cliente.', entries: [
    ['unlinked','TV aguardando ativação','Vincular uma TV não configurada'],['devices','Ativar ou editar uma TV','Gerenciar o dispositivo'],['webaccess','Player Web','Ativação no navegador'],['downloads','Aplicativos e links','Instalação do aplicativo'],['whiteLabel','Meus aplicativos','Gerenciar aplicativos personalizados'] ] },
  conta: { title: 'Administração de usuários', intro: 'Acessos de outros usuários e auditoria de equipe.', entries: [
    ['users','Usuários e acessos','Gerenciar usuários autorizados'],['loginhistory','Histórico de login','Consultar acessos registrados'],['notifications','Notificações','Avisos e mensagens'],['audit','Auditoria','Histórico de operações'] ] },
};
export function OperationCenter({ section, onNavigate, allowed = () => true }) {
  const config = CENTER_CONFIG[section];
  if (!config) return null;
  const entries = config.entries.filter(([id]) => allowed(id));
  return <section className="operation-center" aria-label={config.title}>
    <header className="operation-center-heading"><span>Central de trabalho</span><h1>{config.title}</h1><p>{config.intro}</p></header>
    <div className="operation-center-grid">{entries.map(([id, title, detail]) => <button type="button" className="operation-center-action" key={id} onClick={() => onNavigate(id)}><strong>{title}</strong><span>{detail}</span><b aria-hidden="true">›</b></button>)}</div>
    {section === 'pagamentos' && getAuth()?.user?.role === 'superadmin' && <MasterPixGlobal/>}
    {!entries.length && <p>Não há ações disponíveis para o seu perfil nesta seção.</p>}
  </section>;
}
