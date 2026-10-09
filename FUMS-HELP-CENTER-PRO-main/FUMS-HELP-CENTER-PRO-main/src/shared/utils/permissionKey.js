function normalizeSegment(value) {
    return (value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9._]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

export function normalizePermissionKey(value) {
    return normalizeSegment(value)
}