# DeltaTV — Ativação direta por licença (correção do fluxo)

## O que muda

A ativação deixa de estar na aba comercial `Clientes → Ativar ou vincular TV`. Agora existe a página **Ativar TV**, diretamente no menu do painel Revenda/Master e do Superadmin.

Fluxo único:

1. MAC da TV (a TV já precisa ter se registrado no aplicativo).
2. Origem da licença: **estoque** (revendedor ou Master com saldo), **código de licença** previamente emitido, ou **emitir e ativar diretamente**.
3. Confirmação e resultado. Não exige selecionar plano comercial de cliente.

O estoque não é alterado na emissão direta. O backend cria/renova a licença e ativa o dispositivo na **mesma transação**. Um pedido idêntico retransmitido usa chave de idempotência para não somar dois prazos.

Permissões:
- **Superadmin:** emissão direta via API administrativa própria, sem estoque.
- **Master principal:** emissão direta **somente** quando o Superadmin habilitou `Emissão própria`, com estado ativo e sem Master superior.
- **Submaster e Revenda:** podem aplicar licença do estoque ou um código de licença válido; **não podem emitir diretamente**.

O mecanismo de planos de clientes permanece separado e não interfere na ativação da TV.

## Pacotes

- `DeltaTV-ativacao-backend-hotfix.zip`: arquivos alterados do backend, nova migração e testes.
- `DeltaTV-ativacao-revenda-hotfix.zip`: somente os arquivos novos/alterados da Revenda.
- `DeltaTV-ativacao-admin-hotfix.zip`: somente os arquivos novos/alterados do Superadmin.
- Pacotes `*-standalone.zip`: código-fonte do painel respectivo com a correção incorporada. Teste em pasta separada.

**Não misture instalações diferentes sem comparar os arquivos primeiro.** Estes patches partem da Revenda com dashboard da rede mais recente, do Superadmin DeltaTV 3.0 e do backend corrigido anteriormente para SQL 42601 e emissão própria.

## Implantação recomendada em HOMOLOGAÇÃO

1. Faça backup completo do PostgreSQL e das três pastas de produção.
2. Extraia o hotfix do backend na mesma raiz do código backend **em homologação**, preservando `.env`.
3. Verifique o status das migrações anteriores (`20261214000001-master-primary-self-issuance.cjs` e outras aplicáveis). Não pule migrações antigas necessárias.
4. Execute `npm run db:migrate:status` e somente depois `npm run db:migrate` **contra o banco de homologação**, para criar `license_direct_device_requests` pela migração aditiva `20261216000001-license-direct-device-activation.cjs`.
5. Reinicie o backend de homologação com PM2 ou comando equivalente e teste a API.
6. Extraia cada hotfix frontend em uma cópia de teste da raiz correspondente, defina `VITE_API_URL` para a **API de homologação** e rode `npm run build`.
7. Valide casos: Revenda com 1 licença disponível, Revenda sem estoque, Master autorizado, Master não autorizado, Submaster, Superadmin, renovação, mesma requisição repetida, MAC inexistente, dispositivo de outra revenda.
8. Somente depois faça deploy progressivo em produção. Não remova a pasta `dist` anterior sem guardar cópia para rollback.

Exemplo de **checagem estática** após extrair o backend:

```bash
node --check src/modules/stock/direct-device-activation.service.js
node --check src/modules/stock/stock.service.js
node --check src/modules/portal/portal.routes.js
node --check src/modules/licenses/license.routes.js
node --test tests/regression/direct-license-activation.test.js
```

Para cada painel:

```bash
npm run build
npm test
```

## Rollback

Restaure os arquivos da versão anterior e faça build a partir dessa cópia. A migração foi projetada para permanecer no banco, de modo a preservar registros de idempotência/auditoria de ativações já realizadas. **Não exclua licenças emitidas nem reverta saldos manualmente.**

## O que não foi homologado

- Não executamos migração em PostgreSQL real, nem testes de transação concorrente ou Pix.
- Não rodamos build Vite completo no ambiente de criação: o npm falhou durante instalação de dependências. Os builds precisam ser testados na VPS de homologação.
- Validação visual real em navegadores e teste de posse do dispositivo por QR/código ainda pendentes.

A emissão direta está limitada a dispositivos previamente registrados e auditada, mas a proteção contra conhecimento de MAC de outra pessoa depende também da política de posse do dispositivo do DeltaTV. Para bloqueio de vínculo indevido em todos os cenários, recomenda-se exigir prova de posse pela TV (pareamento) em uma evolução compatível com os players.
