import "./workspace-dashboard.css";

/** Todas as funções do painel na tela inicial, agrupadas, abrindo direto a página
 * (mesmo conjunto e mesmas permissões do menu lateral). */
export default function AllFunctions({ groups, onNavigate }) {
  const visible = (groups || []).filter(g => g.items.length);
  if (!visible.length) return null;
  return <section className="dw-home-hubs" aria-labelledby="all-functions-heading">
    <div className="dw-group-heading"><div><span className="dw-kicker">ACESSO DIRETO</span><h2 id="all-functions-heading">Todas as funções</h2><p>Toque em qualquer opção para abrir direto, sem passar por outros painéis.</p></div></div>
    {visible.map(g => <div key={g.label}>
      <h3 className="af-group">{g.label}</h3>
      <div className="af-grid">{g.items.map(item => <button type="button" className="af-tile" key={item.id} onClick={() => onNavigate(item.id)}>
        <span className="af-tile-icon" aria-hidden="true">{item.icon}</span>
        <span className="af-tile-label">{item.label}</span>
        {item.badge > 0 && <span className="af-badge">{item.badge > 99 ? "99+" : item.badge}</span>}
      </button>)}</div>
    </div>)}
  </section>;
}
