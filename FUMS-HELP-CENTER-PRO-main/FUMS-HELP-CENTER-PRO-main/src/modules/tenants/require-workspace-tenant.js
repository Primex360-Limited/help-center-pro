import { AppError } from "../../shared/errors/AppError.js";

/**
 * Fail-closed guard for workspace data routes (tickets, customers, agents).
 * Uses the bound JWT / host tenant id — does not require a subdomain so
 * local API clients with a tenant-scoped session still work.
 */
export function requireWorkspaceTenant(req, _res, next) {
    const tenantId =
        req.tenantId ??
        req.currentUser?.tenantId ??
        req.user?.tenant_id ??
        null;

    if (!tenantId) {
        return next(
            new AppError(
                "This endpoint requires an active workspace session",
                403
            )
        );
    }

    req.tenantId = tenantId;
    return next();
}

export default requireWorkspaceTenant;
