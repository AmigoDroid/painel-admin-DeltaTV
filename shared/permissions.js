/** Server authorization remains mandatory; this guard controls rendering only. */
export const PANEL_ROLES = {
  admin: ["superadmin", "admin", "support"],
  revenda: ["partner"],
  parceiro: ["partner"],
};
export const panelAllows = (panel, user) =>
  Boolean(user?.id && PANEL_ROLES[panel]?.includes(user.role));

const ADMIN_PAGES = {
  dashboard: "dashboard:read",
  licenses: "licenses:read",
  partners: "partners:read",
  resellers: "partners:read",
  clients: "clients:read",
  billing: "billing:read",
  pix: "billing:read",
  gateways: "billing:read",
  "global-config": "billing:read",
  "service-packages": "partners:read",
  credits: "billing:read",
  devices: "devices:read",
  unlinked: "devices:read",
  support: "devices:read",
  sources: "sources:read",
  webaccess: "web:read",
  downloads: "downloads:read",
  audit: "audit:read",
  servermonitor: "devices:read",
};
export function adminPageAllowed(page, user) {
  if (user?.role === "superadmin") return true;
  // Administradores de rede só podem abrir o workspace isolado; jamais telas globais.
  if (user?.role === "admin") return page === "workspace" || page === "conta";
  if (!user?.permissionRoleId) return true;
  if (page === "conta") return true;
  const needed = ADMIN_PAGES[page];
  return Boolean(needed && user.permissions?.includes(needed));
}
