# Indicador “Offline há X minutos”

Esta versão mostra o tempo de ausência nos cadastros de **Parceiros** e **Revendas**, no painel Superadmin.

- O estado **Online** continua sendo determinado pelas conexões WebSocket ativas.
- Quando a última conexão do parceiro é encerrada, o backend envia `partner-presence` com `lastDisconnectedAt`, e o painel passa a contar a partir desse horário.
- Após recarregar o navegador, a duração é calculada com `lastPortalActivityAt`, já retornado pela API. Pode haver pequena diferença em relação ao desligamento exato, principalmente se houver interrupção de rede ou desligamento abrupto.
- Se nunca houve atividade registrada, o painel informa **Sem atividade registrada**.
- O relógio dos indicadores avança a cada 30 segundos, apenas no navegador; não cria requisições extras para atualizar o texto.
- Nenhuma nova tabela nem migration é necessária. Publique backend e painel juntos para a melhor precisão.

## Teste recomendado

1. Entre no Superadmin e abra Parceiros ou Revendas.
2. Em outro navegador, entre no portal de uma dessas contas.
3. Confira `Online` e feche o portal da conta observada.
4. Depois da detecção da desconexão, confira `Offline` e `há poucos segundos`, avançando para `há 1 minuto` e assim por diante.
5. Reabra o painel Superadmin e confira que a duração reaparece a partir da última atividade persistida.
6. Abra duas sessões da mesma conta/parceria e feche apenas uma: deve continuar `Online` até encerrar a última conexão.
