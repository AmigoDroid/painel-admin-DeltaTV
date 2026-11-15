/** Organização por tarefas, não por nomes internos do backend. */
export const WORK_AREAS = {
  'area/operacao': {id:'area/operacao',label:'Atendimento e TVs',icon:'devices',description:'Cadastre clientes, localize dispositivos, ative licenças e acompanhe atendimentos em um só ambiente.',items:[
    {id:'clients',page:'clients',label:'Clientes',description:'Cadastros comerciais e relacionamento com clientes',icon:'clients'},
    {id:'devices',page:'devices',label:'Dispositivos',description:'Localizar, configurar e auditar as TVs',icon:'devices'},
    {id:'ativar-tv',page:'ativar-tv',label:'Ativar TV com licença',description:'Informar MAC e aplicar licença conforme autorização',icon:'ativar-tv'},
    {id:'unlinked',page:'unlinked',label:'TVs sem configuração',description:'Dispositivos aguardando cadastro ou vínculo',icon:'unlinked'},
    {id:'support',page:'support',label:'Diagnóstico e suporte',description:'Verificar falhas e orientar atendimento',icon:'support'},
  ]},
  'area/rede': {id:'area/rede',label:'Rede comercial',icon:'network',description:'Administre a rede comercial, Masters, Submasters, revendas e as regras de comissionamento.',items:[
    {id:'resellers',page:'resellers',label:'Revendas',description:'Gerenciar contas e aprovações',icon:'resellers'},
    {id:'partners',page:'partners',label:'Parceiros',description:'Cadastro e administração das parcerias',icon:'partners'},
    {id:'network',page:'network',label:'Rede de distribuição',description:'Hierarquia, convites, permissões e Masters',icon:'network'},
    {id:'area/rede/comissoes',page:'commerce3',tab:'commissions',label:'Comissões',description:'Política global e percentuais por nível',icon:'commerce3'},
  ]},
  'area/planos': {id:'area/planos',label:'Planos e licenças',icon:'licenses',description:'Gerencie os planos SaaS e o licenciamento das TVs sem misturar operações financeiras.',items:[
    {id:'commerce3',page:'commerce3',tab:'plans',label:'Planos SaaS',description:'Catálogo de assinaturas e franquias dos Masters',icon:'commerce3'},
    {id:'area/planos/contratos',page:'commerce3',tab:'contracts',label:'Contratos dos Masters',description:'Consultar e associar planos a contas',icon:'commerce3'},
    {id:'pricing',page:'pricing',label:'Preços e condições',description:'Tabela comercial e políticas de preços',icon:'pricing'},
    {id:'licenses',page:'licenses',label:'Licenças das TVs',description:'Consultar, renovar e supervisionar licenças',icon:'licenses'},
  ]},
  'area/financeiro': {id:'area/financeiro',label:'Financeiro',icon:'billing',description:'Um único local para cobranças, saldos, créditos e pagamentos Pix.',items:[
    {id:'billing',page:'billing',label:'Faturas e financeiro',description:'Cobranças, vencimentos e relatórios',icon:'billing'},
    {id:'pix',page:'pix',label:'Pagamentos Pix',description:'Cobranças e confirmações Pix',icon:'pix'},
    {id:'credits',page:'credits',label:'Créditos comerciais',description:'Saldos e movimentações de créditos',icon:'credits'},
  ]},
  'area/aplicativos': {id:'area/aplicativos',label:'Aplicativos',icon:'whiteLabel',description:'Player Web, aplicativos para TV, downloads e personalização comercial.',items:[
    {id:'whiteLabel',page:'whiteLabel',label:'Aplicativos White Label',description:'Gerenciamento de aplicativos personalizados',icon:'whiteLabel'},
    {id:'webaccess',page:'webaccess',label:'Player Web',description:'Acessos e ativações no navegador',icon:'webaccess'},
    {id:'downloads',page:'downloads',label:'Downloads e instalação',description:'Links e instruções de instalação',icon:'downloads'},
  ]},
  'area/infra': {id:'area/infra',label:'Servidores e infraestrutura',icon:'servermonitor',description:'Fontes de conteúdo, qualidade das URLs e ferramentas de infraestrutura.',items:[
    {id:'sources',page:'sources',label:'Fontes de conteúdo',description:'URLs e configuração das origens',icon:'sources'},
    {id:'servermonitor',page:'servermonitor',label:'Qualidade dos servidores',description:'Latência, disponibilidade e saúde dos links',icon:'servermonitor'},
    {id:'vpsmonitor',page:'vpsmonitor',label:'Monitoramento da VPS',description:'Informações operacionais da infraestrutura',icon:'vpsmonitor'},
    {id:'vpsfiles',page:'vpsfiles',label:'Arquivos da VPS',description:'Ferramentas avançadas de arquivos',icon:'vpsfiles'},
  ]},
  'area/administracao': {id:'area/administracao',label:'Administração',icon:'users',description:'Controle de usuários, auditoria, lixeira e comunicação administrativa.',items:[
    {id:'users',page:'users',label:'Usuários e acessos',description:'Controle de contas administrativas',icon:'users'},
    {id:'audit',page:'audit',label:'Auditoria',description:'Eventos e ações da plataforma',icon:'audit'},
    {id:'trash',page:'trash',label:'Lixeira',description:'Recuperação e exclusão definitiva',icon:'trash'},
    {id:'loginhistory',page:'loginhistory',label:'Histórico de login',description:'Sessões e acessos',icon:'loginhistory'},
    {id:'notifications',page:'notifications',label:'Notificações',description:'Mensagens administrativas',icon:'notifications'},
    {id:'mail',page:'mail',label:'E-mails',description:'Comunicação por e-mail',icon:'mail'},
    {id:'help',page:'help',label:'Central de ajuda',description:'Tutoriais e orientações',icon:'help'},
  ]},
};
export const LEGACY_CENTERS = {pagamentos:'area/financeiro',dispositivos:'area/operacao',licenciamento:'area/planos',ativacao:'area/operacao'};
/** URLs novas dos dashboards. Rotas originais (ex.: #/clientes ou #clients)
 * continuam abrindo exatamente as páginas legadas e não são interceptadas. */
export function workAreaPath(area, item) {
  return `${area.id}/secao/${encodeURIComponent(item.id)}`;
}
export function findWorkArea(route) {
  return Object.values(WORK_AREAS).find(area =>
    route === area.id || area.items.some(item => workAreaPath(area, item) === route || (item.id.startsWith('area/') && item.id === route))
  ) || null;
}
