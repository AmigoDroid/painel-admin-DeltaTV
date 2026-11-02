# Superadmin — Condições comerciais do parceiro

Em Parceiros > abrir parceiro > `Contrato de conteúdo` configure: plano legado, pré-pago em créditos, mensalidade fixa ilimitada ou mensalidade fixa com limite.

O saldo é concedido/ajustado no mesmo separador, com motivo obrigatório e trilha de auditoria. O parceiro distribui saldo aos seus códigos no domínio parceiro.deltatv.com.br.

A política `Dependente da parceria` condiciona o acesso da ativação à parceria e ao código ativo. Revogação explícita pela área do parceiro remove credenciais no backend; apagar fisicamente catálogo/cache da TV requer suporte do aplicativo.

Modalidade fixa atualiza `billingModel=fixed` e `monthlyFeeCents` do faturamento da Delta TV. Modalidade créditos usa `billingModel=none`. Evite alterar o mesmo contrato pela antiga tela de cobrança.

Depois de publicar o backend e aplicar a migração, compile este painel com `npm ci && npm run build`.
