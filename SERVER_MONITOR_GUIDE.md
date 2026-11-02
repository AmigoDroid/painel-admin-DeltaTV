# DeltaTV — Monitoramento (Admin)

Nova tela **Parceiros → Monitoramento**. Consome `/api/v1/admin/server-monitor`, com os filtros por estado, busca, contadores, paginação e atualização por WebSocket. Acesso depende da permissão `partners:read`.

Usar `VITE_API_URL=https://api.deltatv.com.br` no `.env.production` ao compilar para a VPS. Não guardar JWT nem segredos dentro de `.env.production`.
