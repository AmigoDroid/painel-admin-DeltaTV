# DeltaTV — Correção da ativação por licença

- Removida aba `Ativar ou vincular TV` dentro de Clientes, que exigia escolher plano comercial.
- Nova página `Ativar TV` em Revenda e Superadmin. Busca MAC pela API e atualizações WebSocket com fallback de consulta.
- Aplicar licença do estoque sem passar por planos de cliente.
- Ativar uma licença preexistente mediante código de licença.
- Emissão e ativação direta em uma transação com idempotência, sem crédito nem estoque intermediário (Superadmin ou Master principal explicitamente autorizado).
- Submaster não recebe capacidade de emissão direta mesmo se possuir permissões de revenda comercial.
- Página de dispositivos mantém listas/diagnóstico e oferece atalho contextual para a nova ativação, com MAC pré-preenchido.
- Componente visual da ativação centralizado em `packages/ui`; cópias em `vendor/deltatv-ui` geradas apenas para os deploys standalone.
- Migração aditiva `20261216000001-license-direct-device-activation.cjs` cria tabela de pedidos de emissão idempotentes.
- Backend Pix, WebSocket, conteúdos e lógica de seleção de servidores não foram alterados.

Validação: 36 testes do frontend Revenda, 1 teste Admin, 4 testes novos do backend; 466 arquivos JS/JSX sem erro sintático e 354 imports relativos válidos. **Sem build Vite ou PostgreSQL real.**
