function trimSlash(value) {
  return String(value || "").replace(/\/$/, "");
}

/**
 * Resolve API base URL.
 * On Render static hosts, fall back to the known API service when VITE_API_URL
 * was not baked in at build time (common Blueprint miss → "Failed to fetch").
 */
/** Avoid `localhost` → ::1 failures when the API is healthy on IPv4 only. */
function preferIpv4Loopback(url) {
  return String(url || "").replace(
    /^http:\/\/localhost(?=:\d|$)/i,
    "http://127.0.0.1"
  );
}

function isLoopbackApi(url) {
  return /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(
    String(url || "").replace(/\/$/, "")
  );
}

function resolveApiUrl() {
  const fromEnv = preferIpv4Loopback(trimSlash(import.meta.env.VITE_API_URL));

  if (typeof window !== "undefined") {
    const host = window.location.hostname || "";

    // Hosted frontends must never call a machine-local API URL baked into .env.
    if (
      host.endsWith(".onrender.com") ||
      host.endsWith(".vercel.app")
    ) {
      // API lives on helpcentre-pro-api — never the static admin/web hosts.
      if (!fromEnv || isLoopbackApi(fromEnv)) {
        return "https://helpcentre-pro-api.onrender.com";
      }
      // Guard against a mis-baked VITE_API_URL pointing at a static SPA host.
      if (
        /helpcentre-pro-(admin|web)\.onrender\.com/i.test(fromEnv) &&
        !/helpcentre-pro-api\.onrender\.com/i.test(fromEnv)
      ) {
        return "https://helpcentre-pro-api.onrender.com";
      }
      return fromEnv;
    }
  }

  // Local Vite: always use the same-origin `/api` proxy. Calling
  // http://127.0.0.1:4008 from http://localhost:5173 (or a LAN IP) drops
  // httpOnly cookies (cross-site) and surfaces "Authorization token is required".
  if (import.meta.env.DEV) {
    if (!fromEnv || isLoopbackApi(fromEnv)) return "";
  }

  if (fromEnv) return fromEnv;
  return "http://127.0.0.1:4008";
}

export const API_URL = resolveApiUrl();
export const APP_NAME = import.meta.env.VITE_APP_NAME || "HelpCentre Pro";
export const API_BASE = API_URL ? `${API_URL}/api/v1` : "/api/v1";

/** `combined` (local), `admin` (platform host), or `tenant` (workspace host). */
export const PORTAL_MODE = (
  import.meta.env.VITE_PORTAL_MODE || "combined"
).toLowerCase();

export const isAdminPortal = PORTAL_MODE === "admin";
export const isTenantPortal = PORTAL_MODE === "tenant";

/** Absolute URL of the dedicated admin site when portals are split. */
export const ADMIN_URL = trimSlash(import.meta.env.VITE_ADMIN_URL || "");

/** Absolute URL of the tenant app when portals are split. */
export const APP_URL = trimSlash(import.meta.env.VITE_APP_URL || "");

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

/**
 * Platform-wide WebRTC gateway (Kamailio/FreeSWITCH/Asterisk `transport ws`).
 *
 * Carriers such as Stuncall only publish a SIP IP + UDP port, which a browser
 * can never dial. When `VITE_SIP_DEFAULT_WSS` is set, every tenant/provider
 * without its own WebSocket URL registers through this gateway, so agents never
 * have to paste one. Tenants can still override it per provider.
 */
export const SIP_DEFAULT_WSS = String(
  import.meta.env.VITE_SIP_DEFAULT_WSS || ""
).trim();
