import { env } from "./env.js";

const defaults = [
    "http://localhost:3000",
    "http://localhost:3005",
    "http://localhost:3006",
    "http://localhost:4008",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3005",
    "http://127.0.0.1:3006",
    "http://127.0.0.1:4008",
    "http://127.0.0.1:5173",
    "https://user-management-system-centralized.onrender.com",
    "https://help-center-pro-frontend.vercel.app",
    // Known Render Blueprint hosts (so Admin login works even if env sync was missed)
    "https://helpcentre-pro-web.onrender.com",
    "https://helpcentre-pro-admin.onrender.com",
];

function splitOrigins(value) {
    return String(value || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

const allowedCors = [
    ...new Set([
        ...defaults,
        env.FRONTEND_URL,
        env.ADMIN_FRONTEND_URL,
        ...splitOrigins(process.env.CORS_ORIGINS)
    ].filter(Boolean))
];

/**
 * Vite binds 0.0.0.0 in local dev, so agents often open the app via a LAN /
 * Tailscale IP. Those origins are not in the static allowlist — allow them
 * only outside production so login does not fail with a opaque network error.
 */
export function isDevLocalOrigin(origin) {
    if (env.NODE_ENV === "production" || !origin) return false;
    try {
        const url = new URL(origin);
        if (url.protocol !== "http:" && url.protocol !== "https:") return false;
        const host = url.hostname;
        if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
            return true;
        }
        // RFC1918 + link-local + Tailscale CGNAT
        if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
        if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
        if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
        if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(host)) {
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

export function isAllowedCorsOrigin(origin) {
    if (!origin) return true;
    return allowedCors.includes(origin) || isDevLocalOrigin(origin);
}

export default allowedCors;
