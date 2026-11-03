export const mbps = bytesPerSecond => bytesPerSecond == null || !Number.isFinite(bytesPerSecond) || bytesPerSecond < 0 ? null : bytesPerSecond * 8 / 1_000_000;
export const networkRate = bytesPerSecond => {
  const value = mbps(bytesPerSecond);
  return value == null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} Mb/s`;
};
export const decimalByteRate = value => value == null || !Number.isFinite(value) || value < 0 ? '—' : `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB/s`;
export function networkVolume(value) {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let index = 0;
  while (value >= 1000 && index < units.length - 1) { value /= 1000; index++; }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${units[index]}`;
}
