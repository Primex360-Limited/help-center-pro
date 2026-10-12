import prisma from "../../database/prisma/client.js";

/**
 * Postgres-backed audit trail (Phase-1 identity).
 *
 * `AuditLog.tenantId` / `AuditLog.userId` are nullable `uuid` foreign keys, so
 * anything that is not a real UUID (legacy Mongo ObjectIds, sentinel strings
 * such as `system:chat-widget`) is persisted as SQL NULL instead of blowing up
 * the insert. `metadata` is a Prisma `Json` column and therefore must not
 * contain `undefined`, which is stripped by a JSON round-trip.
 */

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toUuidOrNull(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const candidate = String(value).trim();

    return UUID_PATTERN.test(candidate) ? candidate : null;
}

function toJsonObject(metadata) {
    if (!metadata || typeof metadata !== "object") {
        return {};
    }

    return JSON.parse(JSON.stringify(metadata));
}

export async function recordAuditLog({
    tenantId = null,
    userId = null,
    action,
    entity = null,
    entityId = null,
    metadata = {}
}) {
    if (!action) {
        return;
    }

    try {
        await prisma.auditLog.create({
            data: {
                tenantId: toUuidOrNull(tenantId),
                userId: toUuidOrNull(userId),
                action,
                entity,
                entityId:
                    entityId === undefined || entityId === null
                        ? null
                        : String(entityId),
                metadata: toJsonObject(metadata)
            }
        });
    } catch (error) {
        console.error("Failed to write audit log:", error.message);
    }
}

export default recordAuditLog;
