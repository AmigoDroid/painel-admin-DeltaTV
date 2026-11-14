# DeltaTV Admin — standalone

Este diretório é independente do monorepo. Contém a biblioteca de UI em `vendor/deltatv-ui/` e o verificador em `scripts/verify-env.mjs`.

## Build em Linux

```bash
cd DeltaTV-admin-standalone
printf 'VITE_API_URL=https://api.deltatv.com.br\n' > .env.production
npm install
npm run build
```

A compilação produz `dist/`, que deve ser testada em homologação antes de substituir o site de produção. Não copie `src/` como se fosse a pasta de arquivos estáticos; o Nginx deve servir a pasta `dist`.

Esta correção resolve caminhos da estrutura e leitura de `.env.production`; não certifica funcionamento completo de todos os recursos.

## Correcao de imports @deltatv/ui

O vite.config.js usa um alias para vendor/deltatv-ui/src. Assim os imports
`@deltatv/ui/Dialog`, `@deltatv/ui/ProfilePage` etc. resolvem mesmo que
o node_modules tenha uma instalacao antiga da biblioteca.

Coloque o conteudo deste pacote diretamente na pasta do painel. Execute
`npm install` e `npm run build`; configure `VITE_API_URL` em `.env.production`.
O Nginx deve servir o diretorio `dist/`, nao os fontes React.
