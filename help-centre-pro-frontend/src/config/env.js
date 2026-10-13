export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4008";
export const APP_NAME = import.meta.env.VITE_APP_NAME || "HelpCentre Pro";
export const API_BASE = `${API_URL}/api/v1`;

/** `combined` (local), `admin` (platform host), or `tenant` (workspace host). */
export const PORTAL_MODE = (
  import.meta.env.VITE_PORTAL_MODE || "combined"
).toLowerCase();

export const isAdminPortal = PORTAL_MODE === "admin";
export const isTenantPortal = PORTAL_MODE === "tenant";

/** Absolute URL of the dedicated admin site when portals are split. */
export const ADMIN_URL = String(import.meta.env.VITE_ADMIN_URL || "").replace(
  /\/$/,
  ""
);

/** Absolute URL of the tenant app when portals are split. */
export const APP_URL = String(import.meta.env.VITE_APP_URL || "").replace(
  /\/$/,
  ""
);

export function adminLoginPath() {
  if (isAdminPortal) return "/login";
  // Never surface the Admin Portal URL from the tenant host.
  if (isTenantPortal) return "/login";
  return "/admin/login";
}

export function tenantLoginPath() {
  if (isTenantPortal) return "/login";
  if (isAdminPortal && APP_URL) return `${APP_URL}/login`;
  return "/login";
}

export function adminSignupPath() {
  // Public admin creation is disabled — always send to admin sign-in.
  return adminLoginPath();
}
