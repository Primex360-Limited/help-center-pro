import prisma from "../../database/prisma/client.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { REQUEST_SCOPE, TENANT_STATUS } from "../../shared/constants/system.js";
import { buildTenantContext } from "./tenant.resolver.js";

function normalizeOrigin(value) {
    try {
        return new URL(String(value || "").trim()).origin;
    } catch {
        return "";
    }
}

function requestOrigin(req) {
    const origin = req.headers?.origin;
    if (origin) {
        return normalizeOrigin(origin);
    }

    const referer = req.headers?.referer || req.headers?.referrer;
    if (referer) {
        return normalizeOrigin(referer);
    }

    return "";
}

/**
 * Resolve and attach `req.tenantContext` (+ `req.tenant` when found) to the
 * request. Mounted globally, before the auth guards, so downstream RBAC can
 * make tenant-aware decisions.
 *
 * A missing/unknown workspace is NOT an error here — the fail-closed guards
 * (`requireTenantScope`, `requireProviderScope`) decide what a route needs.
 */
export async function attachTenantContext(req, res, next) {
    try {
        const context = buildTenantContext(req);
        req.tenantContext = context;

        if (context.scope === REQUEST_SCOPE.PROVIDER || !context.slug) {
            return next();
        }

        const tenant = await prisma.tenant.findFirst({
            where: {
                OR: [{ slug: context.slug }, { primaryDomain: context.slug }]
            }
        });

        if (tenant) {
            context.tenant = tenant;
            req.tenant = tenant;
        }

        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Guard for workspace-scoped routes.
 *
 * - Requires a resolvable, known tenant (404 otherwise).
 * - Blocks suspended tenants with 403 (PRD: suspended tenant => 403 on every
 *   workspace request, plus session invalidation handled in auth.service).
 * - Blocks tenants still `provisioning` until setup finished.
 */
export function requireTenantScope({ allowProvisioning = false } = {}) {
    return function tenantScopeGuard(req, res, next) {
        const context = req.tenantContext;

        if (!context) {
            return next(
                new AppError("Tenant context was not resolved for this request", 500)
            );
        }

        if (context.scope === REQUEST_SCOPE.PROVIDER) {
            return next();
        }

        if (!context.tenant) {
            return next(
                new AppError(
                    context.slug
                        ? `Unknown workspace "${context.slug}"`
                        : "A workspace subdomain is required for this endpoint",
                    404
                )
            );
        }

        if (context.tenant.status === TENANT_STATUS.SUSPENDED) {
            return next(new AppError("This workspace has been suspended", 403));
        }

        if (!allowProvisioning && context.tenant.status !== TENANT_STATUS.ACTIVE) {
            return next(new AppError("This workspace is not active yet", 403));
        }

        next();
    };
}

/**
 * Guard for the provider super-admin portal.
 *
 * Fail closed: the authenticated identity must be a provider account with no
 * workspace binding. Host/subdomain hints alone are never enough.
 */
export function requireProviderScope(req, res, next) {
    const isProviderUser =
        req.user?.user_type === "provider" &&
        (req.user?.tenant_id === null || req.user?.tenant_id === undefined);

    if (!isProviderUser) {
        return next(
            new AppError(
                "This endpoint is only available to HelpCentre Pro platform administrators",
                403
            )
        );
    }

    return next();
}

/**
 * In production, browser calls to admin bootstrap APIs must come from the
 * Admin Portal origin when ADMIN_FRONTEND_URL is configured and differs from
 * the tenant app. Non-browser clients (no Origin/Referer) are allowed for
 * ops tooling; tenant browser origins are rejected.
 */
export function requireAdminPortalOrigin(req, res, next) {
    if (env.NODE_ENV !== "production") {
        return next();
    }

    const adminOrigin = normalizeOrigin(env.ADMIN_FRONTEND_URL);
    const appOrigin = normalizeOrigin(env.FRONTEND_URL);

    if (!adminOrigin || adminOrigin === appOrigin) {
        return next();
    }

    const incoming = requestOrigin(req);
    if (!incoming) {
        return next();
    }

    if (incoming === adminOrigin) {
        return next();
    }

    return next(
        new AppError(
            "Admin actions must be performed from the Admin Portal",
            403
        )
    );
}

/**
 * Bind the resolved tenant to `req.user` so services never have to re-derive
 * it, and reject requests whose JWT tenant contradicts the URL host.
 * Mount after `requireAuth`.
 */
export function bindTenantToUser(req, res, next) {
    const context = req.tenantContext;

    if (!context) {
        return next(
            new AppError("Tenant context was not resolved for this request", 500)
        );
    }

    /**
     * `requireAuth` already hydrated the authoritative workspace from the
     * database, so keep it when present (`null` => provider scope) and only
     * fall back to the token claim when this middleware is mounted on its own.
     */
    const authTenantId =
        req.tenantId !== undefined ? req.tenantId : req.user?.tenant_id ?? null;

    if (context.tenant && authTenantId && context.tenant.id !== authTenantId) {
        return next(
            new AppError("Your session does not belong to this workspace", 403)
        );
    }

    /**
     * A workspace host scopes the request to that workspace, which is how a
     * provider operator acting inside a tenant gets tenant-scoped data; on the
     * apex/admin host the authenticated user's own scope is preserved.
     */
    req.tenantId = context.tenant?.id ?? authTenantId;

    next();
}

export default attachTenantContext;
