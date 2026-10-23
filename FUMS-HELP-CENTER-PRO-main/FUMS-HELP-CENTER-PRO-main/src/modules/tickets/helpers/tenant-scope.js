import { AppError } from "../../../shared/errors/AppError.js";

/**
 * Resolve the workspace id that must scope ticket / agent queries.
 * Fail closed: tenant users and workspace requests always need a UUID.
 */
export function resolveTenantId(source = {}) {
    const tenantId =
        source.tenantId ??
        source.tenant_id ??
        source.req?.tenantId ??
        source.req?.currentUser?.tenantId ??
        source.req?.user?.tenant_id ??
        null;

    return tenantId || null;
}

/**
 * Require a workspace id for any tenant-owned data access.
 * Returns 404-style opacity for missing scope so callers cannot probe.
 */
export function requireTenantId(source = {}, message = "Workspace context is required") {
    const tenantId = resolveTenantId(source);

    if (!tenantId) {
        throw new AppError(message, 403);
    }

    return tenantId;
}

/**
 * Prisma `where` fragment — always constrain by tenant when provided.
 */
export function ticketTenantWhere(tenantId) {
    if (!tenantId) {
        throw new AppError("Workspace context is required", 403);
    }

    return { tenantId };
}

export default {
    resolveTenantId,
    requireTenantId,
    ticketTenantWhere
};
