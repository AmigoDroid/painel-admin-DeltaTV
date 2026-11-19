/** Display-only mapping for DeltaTV installation guides. Download URLs/codes come from the existing catalog. */
export function safeHttpLink(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

const searchable = item => `${item?.name || ""} ${item?.downloadUrl || ""}`.toLowerCase();
export const isRokuItem = item => /\broku\b/.test(searchable(item));
export const isSamsungItem = item => /\bsamsung\b|\btizen\b/.test(searchable(item));
export const isLgItem = item => /\blg\b|\bwebos\b/.test(searchable(item));
export const isAndroidItem = item => !isRokuItem(item) && !isSamsungItem(item) && !isLgItem(item) &&
  (Boolean(item?.hosted) || /\.apk(?:[?#]|$)/i.test(item?.downloadUrl || "") ||
   /\bandroid\b|\btv[\s-]?box\b/.test(searchable(item)) || Boolean(item?.downloaderCode));

/** Prefer the official DeltaTV entry over generic/white-label items, when possible. */
export function selectAndroidApp(items = []) {
  const apps = items.filter(x => x.kind !== "link" && isAndroidItem(x));
  return apps.find(x => /delta\s*tv/i.test(x.name || "")) || apps[0] || null;
}

/** Only an official Roku Store listing may be presented as the Roku app download. */
export function selectRokuStore(items = []) {
  return items.find(x => {
    if (!isRokuItem(x)) return false;
    const link = safeHttpLink(x.downloadUrl);
    if (!link) return false;
    const u = new URL(link);
    return ["channelstore.roku.com", "my.roku.com"].includes(u.hostname);
  }) || null;
}

export function clientInstructions(item) {
  if (!item) return "";
  const lines = [`${item.name || "DeltaTV"} — instruções de instalação`];
  if (item.downloaderCode) lines.push(`No app Downloader, digite: ${item.downloaderCode}.`);
  if (safeHttpLink(item.downloadUrl)) lines.push(`Link de download: ${safeHttpLink(item.downloadUrl)}`);
  lines.push("Depois de instalar, abra o aplicativo e configure com os dados fornecidos por sua revenda.");
  return lines.join("\n");
}
