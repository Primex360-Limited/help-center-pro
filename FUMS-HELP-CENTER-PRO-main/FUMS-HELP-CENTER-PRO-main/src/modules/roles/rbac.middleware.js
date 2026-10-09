import { AppError } from "../../shared/errors/AppError.js";
import { USER_STATUS } from "../../shared/constants/system.js";
import { normalizePermissionKey } from "../../shared/utils/permissionKey.js";
import { getEffectivePermissionsFromUser, isSuperAdminUser } from "./role.service.js";

export function requirePermission(...permissionNames) {
    const requiredPermissions = permissionNames
        .flat()
        .map((permission) => normalizePermissionKey(permission))
        .filter(Boolean);

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
