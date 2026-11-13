import React from "react";
import "./easy-start.css";

const TASKS = {
  admin: [
    { id: "support", icon: "search", title: "A TV de um cliente não funciona", desc: "Encontre o cliente e descubra o que precisa ser corrigido.", primary: true },
    { id: "clients", icon: "users", title: "Quero encontrar um cliente", desc: "Consulte cadastro, vencimento e aparelho em um só lugar." },
    { id: "devices", icon: "tv", title: "Quero acompanhar uma TV", desc: "Veja conexão, lista e informações disponíveis do dispositivo." },
    { id: "resellers", icon: "store", title: "Quero gerenciar uma revenda", desc: "Veja cadastros, permissões e situação comercial." },
    { id: "billing", icon: "wallet", title: "Quero conferir pagamentos", desc: "Encontre cobranças pendentes e recebimentos." },
    { id: "servermonitor", icon: "pulse", title: "Quero verificar os servidores", desc: "Veja quais links precisam de atenção." },
  ],
  reseller: [
    { id: "clientes", icon: "users", title: "Quero cadastrar ou renovar um cliente", desc: "Abra o cadastro e atualize a data de vencimento.", primary: true },
    { id: "suporte", icon: "search", title: "A TV do cliente não funciona", desc: "Busque pelo nome, telefone ou identificador da TV." },
    { id: "dispositivos", icon: "tv", title: "Quero ativar ou configurar uma TV", desc: "Encontre a TV e gerencie a lista vinculada." },
    { id: "estoque", icon: "shield", title: "Preciso de licenças", desc: "Veja quantas licenças estão disponíveis para ativação.", resellerOnly: true },
    { id: "codigos", icon: "key", title: "Quero passar um código ao cliente", desc: "Consulte os códigos usados para conectar a TV." },
    { id: "ajuda", icon: "help", title: "Quero aprender a usar o painel", desc: "Abra o guia com instruções passo a passo." },
  ],
  partner: [
    { id: "support", icon: "search", title: "Um cliente não consegue assistir", desc: "Verifique o dispositivo e descubra o que aconteceu.", primary: true },
    { id: "servers", icon: "server", title: "Quero configurar um servidor", desc: "Cadastre ou ajuste os links de conteúdo." },
    { id: "monitor", icon: "pulse", title: "Quero saber se os links estão funcionando", desc: "Consulte resposta, quedas e disponibilidade." },
    { id: "codes", icon: "key", title: "Quero criar um código para a TV", desc: "Associe um código aos servidores autorizados." },
    { id: "customers", icon: "users", title: "Quero localizar um cliente", desc: "Consulte clientes e vinculações da parceria." },
    { id: "help", icon: "help", title: "Quero entender como funciona", desc: "Aprenda as tarefas mais importantes do painel." },
  ],
};

function TaskIcon({ name }) {
  const strokes = {
    search: <><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/></>,
    users: <><circle cx="12" cy="8" r="3.5"/><path d="M4 20c.5-3.7 3.3-6 8-6s7.5 2.3 8 6"/></>,
    tv: <><rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M9 21h6m-3-3.5V21"/></>,
    store: <><path d="M4 9.5 5.8 4h12.4L20 9.5M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0M5 12.5V20h14v-7.5"/></>,
    wallet: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18m-6 4h3"/></>,
    pulse: <path d="M2 12h4l3-6 4 12 3-6h6"/>,
    shield: <><path d="m12 2 8 3v6c0 5-3.2 8.5-8 11-4.8-2.5-8-6-8-11V5z"/><path d="m9 12 2 2 4-4"/></>,
    key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-4 4 3 3"/></>,
    server: <><rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.1M8 16.5h.1"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 0 1 5 0c0 2-2.6 2.4-2.6 4.5m0 3h.1"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{strokes[name] || strokes.help}</svg>;
}

/** Ações reais de navegação; nenhuma mudança em licenças ou clientes acontece sem abrir a tela específica. */
export default function EasyStart({ role, onNavigate, reseller = true }) {
  const tasks = (TASKS[role] || TASKS.reseller).filter(t => reseller || !t.resellerOnly);
  return <section className="easy-start" aria-labelledby="easy-start-title">
    <div className="easy-intro">
      <span className="easy-eyebrow">COMECE POR AQUI</span>
      <h2 id="easy-start-title">O que você precisa fazer hoje?</h2>
      <p>Escolha uma tarefa. O DeltaTV abre a área certa para você, sem precisar entender termos técnicos.</p>
    </div>
    <div className="easy-task-grid">
      {tasks.map(task => <button key={task.id} type="button" className={`easy-task ${task.primary ? 'easy-task-primary' : ''}`} onClick={() => onNavigate(task.id)}>
        <span className="easy-task-icon"><TaskIcon name={task.icon}/></span>
        <span className="easy-task-copy"><strong>{task.title}</strong><small>{task.desc}</small></span>
        <span className="easy-task-arrow" aria-hidden="true">→</span>
      </button>)}
    </div>
    <div className="easy-help-note"><span aria-hidden="true">💡</span><span>Não sabe onde começar? Use <b>“A TV não funciona”</b> para receber uma orientação com base nas informações do dispositivo.</span></div>
  </section>;
}


/** Ajuda contextual por tarefa — não depende de chamadas extras à API. */
const PAGE_GUIDES = {
  admin: {
    support: ["Descobrir por que uma TV não funciona", "Pesquise o cliente pelo nome ou identificador da TV.", "Leia a causa provável indicada pelo diagnóstico.", "Escolha uma ação apenas se ela for adequada ao problema."],
    clients: ["Consultar ou atualizar um cliente", "Localize a pessoa no campo de busca.", "Confira o cadastro e os dispositivos associados.", "Altere os dados necessários e confirme antes de salvar."],
    devices: ["Encontrar e acompanhar uma TV", "Procure a TV pelo identificador ou pelo cliente.", "Verifique o estado da conexão e a licença.", "Abra as ações remotas somente quando necessário."],
    licenses: ["Conferir uma licença", "Localize a licença ou o dispositivo.", "Confira o prazo e a situação atual.", "Renove ou altere o acesso somente após confirmar o cliente."],
    resellers: ["Administrar uma revenda", "Encontre a revenda desejada.", "Confira a situação comercial e os limites.", "Faça alterações na revenda correta e salve."],
    billing: ["Conferir uma cobrança", "Pesquise a empresa ou a fatura.", "Confira vencimento, valor e pagamento.", "Registre a mudança somente com confirmação."],
    servermonitor: ["Verificar a saúde dos links", "Procure o servidor com aviso de falha.", "Confira a última medição e a frequência do problema.", "Analise o histórico antes de trocar um servidor."],
  },
  reseller: {
    suporte: ["Resolver o problema de uma TV", "Busque pelo nome do cliente, telefone ou identificador.", "Leia o diagnóstico em linguagem simples.", "Se necessário, solicite uma atualização ou revalidação."],
    clientes: ["Cadastrar ou renovar um cliente", "Encontre o cadastro ou inicie um novo.", "Confira nome, TV e vencimento do serviço.", "Salve e confirme se a data ficou correta."],
    dispositivos: ["Ativar ou configurar um aparelho", "Localize a TV pelo identificador exibido no aplicativo.", "Confira qual lista e licença estão associadas.", "Confirme a ativação e peça ao cliente que teste."],
    estoque: ["Conferir licenças disponíveis", "Consulte a quantidade disponível.", "Escolha uma licença compatível com a necessidade.", "Associe ao dispositivo correto antes de confirmar."],
    codigos: ["Compartilhar um código com o cliente", "Escolha o código vinculado à sua lista.", "Confira se está ativo e disponível.", "Envie o código ao cliente para configurar a TV."],
    notificacoes: ["Ver seus comunicados", "Veja os avisos mais recentes.", "Abra o comunicado para ler todos os detalhes.", "Siga as orientações, se houver alguma ação pendente."],
  },
  partner: {
    support: ["Descobrir por que a TV não funciona", "Localize o cliente ou a ativação.", "Leia o diagnóstico e veja qual servidor está selecionado.", "Execute uma ação autorizada apenas se necessário."],
    servers: ["Configurar links de conteúdo", "Confira os servidores já cadastrados.", "Adicione ou atualize a URL correta.", "Salve e verifique a resposta no monitoramento."],
    monitor: ["Ver se o servidor está funcionando", "Observe quais links apresentaram falhas.", "Confira a quantidade de testes e a última resposta.", "Use os dados para escolher a melhor alternativa."],
    codes: ["Preparar um código para a TV", "Escolha ou gere um código de acesso.", "Associe os servidores que podem atender esse código.", "Confira as permissões e compartilhe com o cliente."],
    customers: ["Encontrar um cliente", "Procure pelo nome ou identificador da TV.", "Confira as informações e a lista vinculada.", "Edite apenas o registro pertencente à sua parceria."],
    devices: ["Acompanhar uma TV", "Localize o dispositivo.", "Confira conexão, licença e origem atual.", "Abra o diagnóstico se houver falhas."],
  }
};

export function EasyPageGuide({ role, page, onBack }) {
  const guide = PAGE_GUIDES[role]?.[page];
  return <aside className="easy-guide" aria-label="Orientação desta página">
    <div className="easy-guide-main">
      <span className="easy-guide-icon" aria-hidden="true">?</span>
      <div><strong>{guide?.[0] || "Você está no lugar certo"}</strong><p>{guide?.[1] || "Use as opções desta tela e confira os dados antes de salvar."}</p></div>
      <button type="button" className="easy-guide-back" onClick={onBack}>← Início</button>
    </div>
    {guide && <details className="easy-guide-steps"><summary>Como fazer, passo a passo</summary><ol>{guide.slice(1).map((step,i)=><li key={i}>{step}</li>)}</ol></details>}
  </aside>;
}
