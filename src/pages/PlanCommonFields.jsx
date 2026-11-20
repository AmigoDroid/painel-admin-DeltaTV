/** Campos técnicos compartilhados: o salvamento e o escopo continuam na tela responsável. */
export const TECHNICAL_PLAN_FLAGS = Object.freeze([
  ["autoFailover", "Failover automático"],
  ["autoPriority", "Prioridade automática"],
  ["emailAlerts", "Alertas por e-mail"],
  ["detailedHistory", "Histórico detalhado"],
]);

export function PlanTechnicalOptions({plan,onChange,className,labelClassName}) {
  const fields = TECHNICAL_PLAN_FLAGS.map(([key,label])=><label key={key} className={labelClassName}>
      <input type="checkbox" checked={!!plan[key]} disabled={key==="autoPriority"&&!plan.autoFailover}
        onChange={event=>onChange(key,event.target.checked)} /> {label}
    </label>);
  return className ? <div className={className}>{fields}</div> : <>{fields}</>;
}

export function PlanVisibilityOption({hidden,onChange,labelClassName}) {
  return <>
    <label className={labelClassName}><input type="checkbox" checked={!!hidden} onChange={event=>onChange(event.target.checked)}/>
      Ocultar da minha rede (o parceiro não vê nem contrata este plano)
    </label>
    <p className="muted">O administrador pode atribuir manualmente planos ocultos; contratos existentes permanecem válidos.</p>
  </>;
}
