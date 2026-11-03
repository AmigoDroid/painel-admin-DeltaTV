import { decimalByteRate, mbps, networkRate, networkVolume } from '../network-format.js';
const number = value => Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—';

function NetworkChart({ history }) {
  const data = history.filter(row => Number.isFinite(row.at));
  const end = data.at(-1)?.at || Date.now();
  const peak = Math.max(1, ...data.flatMap(row => [row.receiveMbps || 0, row.sendMbps || 0]));
  const path = key => {
    let open = false;
    return data.map(row => {
      const value = row[key];
      if (!Number.isFinite(value)) { open = false; return ''; }
      const x = Math.max(0, Math.min(100, (row.at - (end - 120000)) / 1200));
      const y = 95 - value / peak * 90;
      const command = `${open ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
      open = true;
      return command;
    }).join(' ');
  };
  const enough = data.filter(row => row.receiveMbps != null && row.sendMbps != null).length >= 2;
  return <section className="card vps-trend vps-network-trend">
    <div className="vps-trend-heading"><h3>Tráfego da VPS</h3><span>Últimos 2 minutos · escala até {number(peak)} Mb/s</span></div>
    <div className="vps-network-legend"><span className="network-receive">● Entrada</span><span className="network-send">● Saída</span></div>
    {enough ? <svg className="vps-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Tráfego de entrada e saída nos últimos dois minutos, escala de zero a ${number(peak)} megabits por segundo`}>
      <path d="M0 25H100 M0 50H100 M0 75H100" stroke="currentColor" strokeWidth="0.4" opacity=".2"/>
      <path d={path('receiveMbps')} className="network-receive" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
      <path d={path('sendMbps')} className="network-send" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
    </svg> : <div className="vps-chart-empty">Coletando amostras de tráfego…</div>}
    <div className="vps-network-axis"><span>2 min atrás</span><span>Agora</span></div>
  </section>;
}

function RateCard({ name, value, total, capacity, tone, hint }) {
  const usage = capacity && value != null ? Math.max(0, Math.min(100, mbps(value) / capacity * 100)) : null;
  return <section className={`card vps-card vps-${tone}`}>
    <div className="vps-card-top"><span className="vps-icon" aria-hidden="true">{tone === 'green' ? '↑' : '↓'}</span><span className="vps-label">{name}</span></div>
    <div className="vps-number">{networkRate(value)}</div><p className="vps-help">{decimalByteRate(value)} · {hint}</p>
    {usage != null && <div className="vps-meter" role="progressbar" aria-label={`Utilização de ${name}`} aria-valuenow={Math.round(usage)} aria-valuemin="0" aria-valuemax="100"><div style={{ width: `${usage}%` }}/></div>}
    <div className="vps-card-foot"><span>Acumulado: {networkVolume(total)}</span><span>{usage == null ? 'Taxa medida entre amostras' : `${number(usage)}% de ${number(capacity)} Mb/s informados`}</span></div>
  </section>;
}

export default function VpsNetwork({ network, transmission, history }) {
  if (!network) return <section className="card"><h3>Tráfego de rede</h3><p className="muted">Atualize e reinicie o backend para receber os indicadores de transmissão.</p></section>;
  return <div className="vps-network">
    <div className="vps-trend-heading"><h3>Rede e transmissão</h3><span>{network.selectedInterfaces?.join(', ') || 'Sem interface externa'} · {network.selection === 'configured' ? 'Seleção configurada' : network.selection === 'default-route' ? 'Rota padrão' : 'Seleção automática'}</span></div>
    {!network.available && <p className="vps-error" role="status">{network.reason || 'Medição de rede indisponível.'}{network.missingInterfaces?.length > 0 ? ` Interfaces ausentes: ${network.missingInterfaces.join(', ')}.` : ''}</p>}
    {network.available && <>
      <div className="vps-network-cards">
        <RateCard name="Entrada na VPS" value={network.receiveBytesPerSecond} total={network.receivedBytes} capacity={network.capacityMbps} tone="blue" hint="Dados recebidos"/>
        <RateCard name="Saída da VPS" value={network.sendBytesPerSecond} total={network.sentBytes} capacity={network.capacityMbps} tone="green" hint="Dados enviados"/>
      </div>
      <NetworkChart history={history}/>
      <div className="card vps-network-interfaces"><h3>Interfaces de rede</h3><div className="table-wrap"><table>
        <thead><tr><th>Interface</th><th>Somada ao total</th><th>Entrada</th><th>Saída</th><th>Recebido</th><th>Enviado</th><th>Erros / descartes</th></tr></thead>
        <tbody>{(network.interfaces || []).map(row => <tr key={row.name}>
          <td className="mono" data-label="Interface">{row.name}{row.counterReset && <small className="muted"> · Contador reiniciado</small>}</td>
          <td data-label="Somada ao total">{row.included ? 'Sim' : 'Não'}</td><td data-label="Entrada">{networkRate(row.receiveBytesPerSecond)}</td><td data-label="Saída">{networkRate(row.sendBytesPerSecond)}</td>
          <td data-label="Recebido">{networkVolume(row.receivedBytes)}</td><td data-label="Enviado">{networkVolume(row.sentBytes)}</td>
          <td data-label="Erros / descartes">{number(row.receiveErrors + row.sendErrors)} / {number(row.receiveDrops + row.sendDrops)}</td>
        </tr>)}</tbody>
      </table></div></div>
    </>}
    <div className="card vps-details"><h3>Retransmissão pelo Node.js</h3><div className="vps-detail-grid">
      <div><small>Streams longos ativos neste processo</small><strong>{number(transmission?.nodeActiveStreams)}</strong></div>
      <div><small>Limite desses streams</small><strong>{transmission?.nodeStreamLimit === 0 ? 'Sem limite definido' : number(transmission?.nodeStreamLimit)}</strong></div>
      <div><small>Entrega via X-Accel-Redirect</small><strong>{transmission?.nginxAccelEnabled ? 'Habilitada na API' : 'Desabilitada na API'}</strong></div>
    </div><p className="muted">Este contador cobre somente streams longos retransmitidos por este processo Node.js. Não conta espectadores de redirecionamentos 302, segmentos HLS curtos ou transmissões entregues pelo Nginx.</p></div>
    <p className="vps-note">A rede inclui Nginx, API, downloads e demais serviços visíveis neste ambiente. Não separa o consumo por serviço ou cliente. Acumulados pertencem aos contadores das interfaces e podem reiniciar com a interface ou o servidor; não representam uma franquia mensal. O gráfico é mantido apenas enquanto esta tela está aberta. {network.intervalSeconds != null && `Intervalo da amostra: ${number(network.intervalSeconds)} s.`}</p>
  </div>;
}
