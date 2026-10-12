import { LEGACY_PERMISSION_ALIASES } from "../constants/permissions.js";

function normalizeSegment(value) {
    return (value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        // Keep the canonical `resource:action` separator (`:`), the legacy dot
        // namespace (`.`) and `_` intact; every other character becomes `_`.
        // Preserving `:` is what lets `LEGACY_PERMISSION_ALIASES` values
        // (`manage_users` -> `agent:read`) match the catalog keys stored in the
        // `Permission` table, which also use `resource:action`.
        .replace(/[^a-z0-9._:]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

/**
 * Normalize a permission key into the canonical `resource:action` namespace.
 *
 * Legacy dot/underscore keys (`ticket.view`, `manage_users`, ...) are resolved
 * through `LEGACY_PERMISSION_ALIASES` so both the legacy catalog and the PRD
 * catalog can be checked with a single string comparison.
 */
export function normalizePermissionKey(value) {
    const normalized = normalizeSegment(value);

    if (!normalized) {
        return "";
    }

    return LEGACY_PERMISSION_ALIASES[normalized] || normalized;
}