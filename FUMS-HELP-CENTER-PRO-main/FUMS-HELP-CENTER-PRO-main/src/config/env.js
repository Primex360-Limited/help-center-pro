import dotenv from "dotenv";

dotenv.config();

function bool(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value).toLowerCase() === "true";
}

export const env = {
    PORT: Number(process.env.PORT) || 4008,
    NODE_ENV: process.env.NODE_ENV || "development",
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
    ROOT_DOMAIN: process.env.ROOT_DOMAIN || "helpcentrepro.com",
    PROVIDER_SUBDOMAIN: process.env.PROVIDER_SUBDOMAIN || "admin",
    TENANT_HEADER: process.env.TENANT_HEADER || "x-tenant-slug",
    FLEXIBLE_USER_MANAGEMENT: process.env.FLEXIBLE_USER_MANAGEMENT,
    // MongoDB now only backs legacy collections; Postgres/Prisma owns the
    // identity layer, so a missing Mongo connection must not be fatal.
    MONGODB_REQUIRED: bool(process.env.MONGODB_REQUIRED, false),
    DATABASE_URL_PRODUCTION: process.env.DATABASE_URL_PRODUCTION,
    POSTGRES_REQUIRED: bool(process.env.POSTGRES_REQUIRED, true),
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SUPPORT_EMAIL_FROM: process.env.SUPPORT_EMAIL_FROM || process.env.EMAIL_FROM,
    EMAIL_ENABLED: bool(process.env.EMAIL_ENABLED, true),
    REDIS_URL: process.env.REDIS_URL,
    REDIS_REQUIRED: bool(process.env.REDIS_REQUIRED, false),
    SEED_TEST_USER: bool(process.env.SEED_TEST_USER, true),
};

export function assertCriticalEnv() {
    const missing = [];

    // Mongo is only required when the deployment still relies on it. The
    // identity layer lives in Postgres/Prisma, so a blank URI is fine when
    // MONGODB_REQUIRED=false.
    if (env.MONGODB_REQUIRED && !env.FLEXIBLE_USER_MANAGEMENT) {
        missing.push("FLEXIBLE_USER_MANAGEMENT");
    }
    if (!env.DATABASE_URL_PRODUCTION) missing.push("DATABASE_URL_PRODUCTION");
    if (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET.length < 32) {
        missing.push("JWT_ACCESS_SECRET (>=32 chars)");
    }
    if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET.length < 32) {
        missing.push("JWT_REFRESH_SECRET (>=32 chars)");
    }

    if (missing.length) {
        throw new Error(`Missing or invalid environment variables: ${missing.join(", ")}`);
    }
}
