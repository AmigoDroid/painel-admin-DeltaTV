# DeltaTV 3.0 — admin

Deploy independente para Nginx / Vite.

1. Configure .env.production com VITE_API_URL=https://api.deltatv.com.br
2. Execute npm install (não rode npm install apenas com arquivos de código atualizados sem a pasta vendor).
3. npm test
4. npm run build
5. Publique SOMENTE dist/ após testes em homologação.

**IMPORTANTE:** implantar o backend/migração em homologação antes de abrir as novas páginas de comércio.
