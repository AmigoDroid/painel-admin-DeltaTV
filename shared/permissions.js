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
// Páginas compartilhadas com a DeltaTV que já possuem leitura/escrita isoladas por rede.
// Uma página ausente daqui continua indisponível para Admins até ter API tenant-safe.
export const ADMIN_SCOPED_PAGES = Object.freeze({
  dashboard: {permission:"network:dashboard:read", view:"dashboard"},
  workspace: {permission:null, view:"workspace"},
  partners: {permission:"network:partners:read", view:"partners"},
  resellers: {permission:"network:resellers:read", view:"resellers"},
  pricing: {permission:"network:plans:read", view:"plans"},
  "service-packages": {permission:"network:plans:read", view:"plans"},
  users: {permission:"network:members:read", view:"members"},
  sources: {permission:"network:resources:read", view:"resources"},
  devices: {permission:"network:devices:read", view:"devices"},
  billing: {permission:"network:billing:read", view:"billing"},
});
export const adminScopedView = page => ADMIN_SCOPED_PAGES[page]?.view ?? null;

export function adminPageAllowed(page, user) {
  if (user?.role === "superadmin") return true;
  // O menu é espelhado, mas TODA página de Admin usa somente /admin/workspace.
  // Não confundir permissão com liberação de rotas globais da DeltaTV.
  if (user?.role === "admin") {
    if (page === "conta") return true;
    const entry = ADMIN_SCOPED_PAGES[page];
    return Boolean(entry && (!entry.permission || user.delegatedPermissions?.includes(entry.permission)));
  }
  if (!user?.permissionRoleId) return true;
  if (page === "conta") return true;
  const needed = ADMIN_PAGES[page];
  return Boolean(needed && user.permissions?.includes(needed));
}
