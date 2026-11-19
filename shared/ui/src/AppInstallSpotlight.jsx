import rokuStoreIcon from "./deltatv-roku-store.png";
import "./app-install-spotlight.css";

/** Atalho na tela inicial: usa a navegação local de cada painel, sem links hardcoded. */
export default function AppInstallSpotlight({ onOpen }) {
  return (
    <section className="dt-app-spotlight" aria-label="Conheça os aplicativos DeltaTV">
      <div className="dt-app-spotlight-art">
        <img src={rokuStoreIcon} alt="Ícone oficial do DeltaTV exibido na Loja Roku" />
        <span className="dt-app-spotlight-store">DeltaTV · Loja Roku</span>
      </div>
      <div className="dt-app-spotlight-content">
        <span className="dt-app-spotlight-eyebrow">CENTRAL DE APLICATIVOS</span>
        <h2>Seu DeltaTV, na tela que você escolher.</h2>
        <p>Instale no Android, TV Box ou TV Roku. Veja como baixar, encontre o código do Downloader e copie o link direto do aplicativo.</p>
        <div className="dt-app-spotlight-platforms" aria-label="Disponibilidade por plataforma">
          <span>Android</span><span>TV Box</span><span>TV Roku</span>
          <span className="dt-app-spotlight-soon">Samsung e LG <b>Em breve</b></span>
        </div>
        <button type="button" className="dt-app-spotlight-action" onClick={onOpen}>
          Ver aplicativos <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
        </button>
      </div>
    </section>
  );
}
