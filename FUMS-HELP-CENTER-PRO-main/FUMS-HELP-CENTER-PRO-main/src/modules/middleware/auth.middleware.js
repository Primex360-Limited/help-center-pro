import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { TENANT_STATUS, USER_STATUS } from "../../shared/constants/system.js";
import { toUuidOrNull } from "../../shared/utils/auditLogger.js";
import { verifyAccessToken } from "../auth/auth.utils.js";
import { USER_ROLE_INCLUDE } from "../roles/role.service.js";

/**
 * Prisma include for an authenticated request.
 *
 * `role`/`permissions` feed RBAC, `tenant` lets a suspended workspace be
 * rejected without a second round-trip.
 */
export const AUTH_USER_INCLUDE = Object.freeze({
    ...USER_ROLE_INCLUDE,
    tenant: { select: { id: true, slug: true, status: true } }
});

/** Read the access token from the httpOnly cookie or the Bearer header. */
export function extractAccessToken(req) {
    if (req.cookies?.accessToken) {
        return req.cookies.accessToken;
    }

    const authHeader = req.headers?.authorization;

    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice("Bearer ".length).trim() || null;
    }

    return null;
}

/**
 * Authenticate a request against the Postgres identity store.
 *
 * On success the following request state is populated:
 *  - `req.user`        - the decoded JWT (`sub`, `user_id`, `tenant_id`, ...)
 *  - `req.currentUser` - the hydrated Prisma user (role + tenant included)
 *  - `req.tenantId`    - the authoritative workspace id (`null` for provider)
 *
 * The database - not the token - decides workspace membership: a token whose
 * `tenant_id` contradicts the stored `User.tenantId` is rejected, as is a
 * request whose host resolves to a different workspace.
 */
export const requireAuth = async (req, res, next) => {
    const token = extractAccessToken(req);

    if (!token) {
        return next(new AppError("Authorization token is required", 401));
    }

    let decoded;

    try {
        decoded = verifyAccessToken(token);
    } catch {
        return next(new AppError("Invalid or expired access token", 401));
    }

    const userId = toUuidOrNull(decoded.sub || decoded.user_id);

    if (!userId) {
        return next(new AppError("Invalid or expired access token", 401));
    }

    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            include: AUTH_USER_INCLUDE
        });

        if (!currentUser) {
            return next(
                new AppError("Authenticated user no longer exists", 401)
            );
        }

        if (currentUser.tenant?.status === TENANT_STATUS.SUSPENDED) {
            return next(new AppError("This workspace has been suspended", 403));
        }

        /**
         * Deactivation must bite immediately: a deactivated (`inactive`) or
         * suspended agent loses access on the next request instead of waiting
         * for their access token to expire. `invited` users keep access so the
         * onboarding flow (change password / profile setup) still works.
         */
        if (
            currentUser.status !== USER_STATUS.ACTIVE &&
            currentUser.status !== USER_STATUS.INVITED
        ) {
            return next(
                new AppError(
                    "Your account has been deactivated. Contact your workspace administrator.",
                    403
                )
            );
        }

        const userTenantId = currentUser.tenantId ?? null;

        if ((decoded.tenant_id ?? null) !== userTenantId) {
            return next(
                new AppError("Your session does not belong to this workspace", 403)
            );
        }

        if (req.tenant && userTenantId && req.tenant.id !== userTenantId) {
            return next(
                new AppError("Your session does not belong to this workspace", 403)
            );
        }

        req.user = decoded;
        req.currentUser = currentUser;
        req.tenantId = userTenantId;

        return next();
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }

        return next(new AppError("Invalid or expired access token", 401));
    }
};

export default requireAuth;
