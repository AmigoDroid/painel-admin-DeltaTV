# DeltaTV — Recuperação das funções dos painéis e dashboards aditivos

## Problema confirmado

A atualização anterior transformou automaticamente todas as rotas de operações em subrotas dos novos dashboards. Ao mesmo tempo, retirou do menu principal os links diretos existentes. Isso tornou funções difíceis de encontrar, e a experiência de vários usuários pareceu ter perdido as funções.

## Correção

- **Rotas antigas preservadas:** na Revenda `#/clientes`, `#/dispositivos`, `#/ativar-tv`, `#/estoque`, `#/licencas`, `#/creditos`, `#/financeiro`, `#/codigos`, etc. No Admin, `#clients`, `#devices`, `#licenses`, `#commerce3`, `#billing`, `#network`, etc. abrem as páginas originais.
- **Dashboards com rotas novas:** `#/area/clientes` na Revenda e `#area/operacao` no Admin. Ao selecionar uma seção interna, sua URL é exclusiva; não há interceptação das rotas antigas.
- **Compatibilidade de links de seções da etapa anterior:** `#/area/clientes/planos`, `#area/planos/contratos` etc. continuam reconhecidos.
- **Todas as funções — acesso direto:** lista expansível no menu principal, aberta por padrão, preserva os botões operacionais com suas permissões.
- **Dentro do dashboard:** existe a opção `Abrir tela original` em qualquer seção.
- **Contas com acesso restrito:** continuam tendo acesso ao próprio perfil e à ajuda no menu.
- **Rede de Revendas:** o dashboard separado `#/rede` foi preservado.
- **Permissões:** não alteradas. As verificações de autorização do servidor continuam prevalecendo.

## O que não foi alterado

Nenhum endpoint do backend, migração, Pix, licença, saldo, emissão, autenticação ou regra financeira. Somente navegação/interface dos dois painéis.

## Instalação em ambiente de teste, sem sobrescrever produção

### Revenda

1. Faça backup da pasta `/var/www/revenda-DeltaTV`.
2. Extraia o **hotfix da Revenda** na pasta de uma cópia de teste ou, após backup, na pasta do painel atual (preservando o `.env.production`).
3. Execute `npm test` e `npm run build`.
4. Confirme que os endereços `#/clientes`, `#/dispositivos`, `#/ativar-tv`, `#/estoque`, `#/rede` e `#/area/clientes` abrem telas funcionais.

### Admin

1. Faça backup de `/var/www/painel-admin-DeltaTV`.
2. Extraia o **hotfix do Admin** numa cópia de teste ou na pasta após backup.
3. Execute `npm test` e `npm run build`.
4. Confirme `#clients`, `#devices`, `#commerce3`, `#network`, `#pix`, `#area/operacao` e `#area/planos` com uma conta autorizada.

Se o Nginx estiver apontando para `dist/` dentro da pasta que você compilou, verifique a versão servida e faça atualização da página sem cache. Não é necessário reiniciar backend.

## Resultado dos testes locais desta entrega

- Revenda: 46 testes aprovados.
- Admin: 10 testes aprovados.
- Parser TypeScript: 127 arquivos JS/JSX analisados, nenhum erro sintático.
- 336 imports relativos analisados, nenhum caminho ausente.
- `npm ci --offline` não pôde instalar as dependências por ausência de `yallist@3.1.1` no cache npm. Logo, **o build Vite não foi executado** e os fluxos de interface ainda exigem homologação autenticada.

## Reversão

Antes de extrair o hotfix, faça uma cópia dos arquivos atuais. Se o novo build falhar ou surgir regressão, restaure os arquivos da cópia e recompile o `dist` antigo. Mantenha o backup da pasta inteira e do `dist` original até concluir a homologação.
