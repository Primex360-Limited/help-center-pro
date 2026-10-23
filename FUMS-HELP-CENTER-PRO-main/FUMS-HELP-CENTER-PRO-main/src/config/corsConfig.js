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

export default allowedCors;
