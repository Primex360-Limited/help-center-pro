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
    ADMIN_FRONTEND_URL:
        process.env.ADMIN_FRONTEND_URL ||
        process.env.FRONTEND_URL ||
        "http://localhost:5173",
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
    // Resend — platform transactional email ONLY (verification, invites,
    // password resets). Support mail uses connected mailboxes (SMTP/IMAP).
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SUPPORT_EMAIL_FROM: process.env.SUPPORT_EMAIL_FROM || process.env.EMAIL_FROM,
    EMAIL_ENABLED: bool(process.env.EMAIL_ENABLED, true),
    // Platform SMTP (transactional mail: verification, invites, resets).
    // No third-party email API — mail is sent directly via SMTP (nodemailer).
    // Leave SMTP_HOST empty in local dev: emails are logged to the console
    // instead of sent, so every flow still works end-to-end.
    SMTP_HOST: process.env.SMTP_HOST || "",
    SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
    SMTP_SECURE: bool(process.env.SMTP_SECURE, false),
    SMTP_USER: process.env.SMTP_USER || "",
    SMTP_PASS: process.env.SMTP_PASS || "",
    /** Public API origin for Twilio webhooks (no trailing slash). */
    PUBLIC_API_URL: process.env.PUBLIC_API_URL || "",
    // Connected-mailbox sync (IMAP/SMTP per agent, see modules/email).
    EMAIL_ENCRYPTION_KEY: process.env.EMAIL_ENCRYPTION_KEY || "",
    EMAIL_SYNC_INTERVAL: Number(process.env.EMAIL_SYNC_INTERVAL) || 15 * 1000,
    EMAIL_SYNC_BATCH_SIZE: Number(process.env.EMAIL_SYNC_BATCH_SIZE) || 50,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "",
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || "",
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || "",
    MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI || "",
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || "",
    TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID || "",
    TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET || "",
    TWILIO_TWIML_APP_SID: process.env.TWILIO_TWIML_APP_SID || "",
    /** Optional fallback if the agent has no phoneNumber on their profile. */
    TWILIO_AGENT_FALLBACK_NUMBER: process.env.TWILIO_AGENT_FALLBACK_NUMBER || "",
    REDIS_URL: process.env.REDIS_URL,
    REDIS_REQUIRED: bool(process.env.REDIS_REQUIRED, false),
    // Off by default — never leak demo users/tickets across workspaces.
    SEED_TEST_USER: bool(process.env.SEED_TEST_USER, false),
    SEED_DEMO_TICKETS: bool(process.env.SEED_DEMO_TICKETS, false),
    // Purge known demo ticket ids on boot (safe / idempotent).
    PURGE_DEMO_DATA: bool(process.env.PURGE_DEMO_DATA, true),
    // Seeds the default platform super admin (ebube.okechukwu@primex360.com).
    SEED_PROVIDER_SUPER_ADMIN: bool(process.env.SEED_PROVIDER_SUPER_ADMIN, true),

    // Microservice mesh (gateway + domain services). Unset = monolith.
    SERVICE_NAME: process.env.SERVICE_NAME || "monolith",
    INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY || "",
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || "",
    TENANT_SERVICE_URL: process.env.TENANT_SERVICE_URL || "",
    IDENTITY_SERVICE_URL: process.env.IDENTITY_SERVICE_URL || "",
    TICKETS_SERVICE_URL: process.env.TICKETS_SERVICE_URL || "",
    NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || "",
    // When true (default if NOTIFICATION_SERVICE_URL set), auth emails go via notification-service.
    USE_NOTIFICATION_SERVICE: bool(
        process.env.USE_NOTIFICATION_SERVICE,
        Boolean(process.env.NOTIFICATION_SERVICE_URL)
    ),

    // Firebase Admin (Google sign-in)
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "",
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || "",
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || "",
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
