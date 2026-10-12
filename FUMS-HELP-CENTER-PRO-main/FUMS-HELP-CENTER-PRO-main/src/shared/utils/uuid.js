/**
 * UUID helpers for the Phase-1 Postgres identity layer.
 *
 * Every primary key in the Prisma schema is a native `uuid` column, so request
 * validation must accept UUIDs (not the 24-char Mongo ObjectIds the legacy
 * validators were written for) and non-UUID strings must be normalized to
 * `null` before they reach a `uuid` column.
 */

export const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Loose UUID regex string (no anchors) for embedding in composite patterns. */
export const UUID_SOURCE =
    "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function isUuid(value) {
    return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

/** Coerce a value to a valid UUID string, or `null` when it is not one. */
export function toUuidOrNull(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const candidate = String(value).trim();

    return UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

export default isUuid;
