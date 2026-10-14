import { env } from "../config/env.js";

/**
 * Canonical microservice map. Gateway routes public /api/v1 traffic here.
 * In monolith mode these URLs are unused; domain code talks in-process.
 */
export const SERVICE_NAMES = Object.freeze({
    GATEWAY: "gateway",
    AUTH: "auth-service",
    TENANT: "tenant-service",
    IDENTITY: "identity-service",
    TICKETS: "tickets-service",
    NOTIFICATION: "notification-service",
    MONOLITH: "monolith"
});

export function getServiceUrls() {
    return {
        auth: env.AUTH_SERVICE_URL || "http://127.0.0.1:4010",
        tenant: env.TENANT_SERVICE_URL || "http://127.0.0.1:4011",
        identity: env.IDENTITY_SERVICE_URL || "http://127.0.0.1:4012",
        tickets: env.TICKETS_SERVICE_URL || "http://127.0.0.1:4013",
        notification: env.NOTIFICATION_SERVICE_URL || "http://127.0.0.1:4014"
    };
}

export function isMicroserviceMode() {
    const name = String(process.env.SERVICE_NAME || SERVICE_NAMES.MONOLITH).toLowerCase();
    return name !== SERVICE_NAMES.MONOLITH && name !== "";
}

export function getCurrentServiceName() {
    return String(process.env.SERVICE_NAME || SERVICE_NAMES.MONOLITH).toLowerCase();
}
