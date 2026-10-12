import { AppError } from "../../shared/errors/AppError.js";
import { USER_STATUS } from "../../shared/constants/system.js";
import {
    ALL_PERMISSION_KEYS,
    PERMISSION_CATALOG
} from "../../shared/constants/permissions.js";
import { normalizePermissionKey } from "../../shared/utils/permissionKey.js";
import { getEffectivePermissionsFromUser, isSuperAdminUser } from "./role.service.js";

/**
 * Canonical permission keys, normalized so legacy aliases
 * (`ticket.view` -> `ticket:read`) collapse onto the PRD catalog.
 */
const CATALOG_PERMISSION_KEYS = new Set(
    ALL_PERMISSION_KEYS.map((key) => normalizePermissionKey(key))
);

/** Is this key part of the canonical `resource:action` catalog? */
export function isCatalogPermission(permission) {
    return CATALOG_PERMISSION_KEYS.has(normalizePermissionKey(permission));
}

/** Keys from the given guards that are NOT in the canonical catalog. */
export function findUnknownPermissions(...permissions) {
    return permissions
        .flat()
        .map((permission) => normalizePermissionKey(permission))
        .filter(
            (permission) => permission && !CATALOG_PERMISSION_KEYS.has(permission)
        );
}

/** Snapshot of the catalog (categories + descriptions) for the roles UI. */
export function getPermissionCatalog() {
    return PERMISSION_CATALOG.map((entry) => ({ ...entry }));
}

/**
 * Guard a route behind one or more permission keys (OR semantics).
 *
 * Enforcement order:
 *  1. authenticated request + hydrated user present
 *  2. account is `active`
 *  3. no pending forced password change
 *  4. request workspace matches the authenticated user's workspace
 *  5. provider super admins bypass the permission list
 *  6. at least one required permission is effectively granted
 *
 * @param {...(string|string[])} permissionNames Catalog permission keys.
 */
export function requirePermission(...permissionNames) {
    const requiredPermissions = permissionNames
        .flat()
        .filter(Boolean)
        .map((permission) => normalizePermissionKey(permission));

    const unknownPermissions = requiredPermissions.filter(
        (permission) => !CATALOG_PERMISSION_KEYS.has(permission)
    );

    if (unknownPermissions.length) {
        // Custom roles can legitimately grant non-catalog keys, so a stale
        // guard must not take the API down: warn and keep enforcing.
        console.warn(
            `[rbac] requirePermission() received keys outside the permission catalog: ${unknownPermissions.join(", ")}`
        );
    }

    return async function (req, res, next) {
        try {
            if (!req.user?.sub || !req.currentUser) {
                return next(new AppError("Unauthorized", 401));
            }

            if (req.currentUser.status !== USER_STATUS.ACTIVE) {
                return next(new AppError("User account is not active", 403));
            }

            if (req.currentUser.mustChangePassword) {
                return next(
                    new AppError(
                        "Password change is required before using protected resources",
                        403
                    )
                );
            }

            const requestTenantId = req.tenantId ?? null;
            const userTenantId = req.currentUser.tenantId ?? null;

            if (requestTenantId && userTenantId && requestTenantId !== userTenantId) {
                return next(
                    new AppError("Your session does not belong to this workspace", 403)
                );
            }

            if (isSuperAdminUser(req.currentUser)) {
                return next();
            }

            const permissions = getEffectivePermissionsFromUser(req.currentUser);
            const allowed = requiredPermissions.some((permission) =>
                permissions.includes(permission)
            );

            if (!allowed) {
                return next(new AppError("Forbidden: insufficient permissions", 403));
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

export default requirePermission;
