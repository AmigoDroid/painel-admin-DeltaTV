import { Component } from "react";
export default class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Falha ao renderizar painel:", error.name);
  }
  render() {
    return this.state.failed ? (
      <main role="alert" style={{ padding: 32, maxWidth: 680, margin: "auto" }}>
        <h1>Não foi possível abrir esta tela</h1>
        <p>
          Recarregue o painel para continuar. Seus dados salvos permanecem no
          servidor.
        </p>
        <button onClick={() => window.location.reload()}>
          Recarregar painel
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
