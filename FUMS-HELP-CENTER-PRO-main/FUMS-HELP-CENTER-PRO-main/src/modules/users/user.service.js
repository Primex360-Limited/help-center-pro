import Role from "../../database/model/role.model.js";
import Session from "../../database/model/session.model.js";
import User from "../../database/model/user.model.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
    AUDIT_ACTION,
    USER_STATUS,
} from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import { normalizePermissionKey } from "../../shared/utils/permissionKey.js";
import { getUserAccessProfile, normalizePermissionList } from "../roles/role.service.js";

async function attachAccessProfile(userOrId) {
    const userId = userOrId?._id || userOrId?.id || userOrId;
    const hydratedUser = await User.findById(userId).populate(
        "roleId",
        "name description permissions"
    );

    if (!hydratedUser) {
        throw new AppError("User not found", 404);
    }

    const accessProfile = await getUserAccessProfile(hydratedUser._id);
    const sanitizedUser = typeof hydratedUser.toJSON === "function"
        ? hydratedUser.toJSON()
        : hydratedUser;

    if (accessProfile.role) {
        sanitizedUser.roleId = accessProfile.role.id;
    }

    return {
        ...sanitizedUser,
        ...accessProfile,
    };
}

function getUpdatedFieldNames(updateData = {}) {
    return Object.keys(updateData).filter((key) => updateData[key] !== undefined);
}

function normalizeDeniedPermissions(permissions = []) {
    return [...new Set(permissions.map((permission) => normalizePermissionKey(permission)).filter(Boolean))];
}

export async function getUsers() {
    const users = await User.find().sort({ createdAt: -1 });

    return Promise.all(users.map((user) => attachAccessProfile(user)));
}

export async function getUserById(userId) {
    return attachAccessProfile(userId);
}

export async function updateUser(userId, data, actedBy = null) {
    const user = await User.findById(userId).populate(
        "roleId",
        "name description permissions"
    );

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const updateData = { ...data };
    let nextRole = user.roleId;

    if (Object.prototype.hasOwnProperty.call(updateData, "roleId")) {
        if (updateData.roleId === null) {
            nextRole = null;
            user.roleId = null;
        } else {
            nextRole = await Role.findById(updateData.roleId);

            if (!nextRole) {
                throw new AppError("Role not found", 404);
            }

            user.roleId = nextRole._id;
        }
    }

    if (updateData.firstName !== undefined) {
        user.firstName = updateData.firstName;
    }

    if (updateData.lastName !== undefined) {
        user.lastName = updateData.lastName;
    }

    if (updateData.phoneNumber !== undefined) {
        user.phoneNumber = updateData.phoneNumber;
    }

    if (updateData.profileImage !== undefined) {
        user.profileImage = updateData.profileImage;
    }

    if (updateData.metadata !== undefined) {
        user.metadata = updateData.metadata;
    }

    if (updateData.status !== undefined) {
        user.status = updateData.status;
    }

    let deniedPermissions = Object.prototype.hasOwnProperty.call(
        updateData,
        "deniedPermissions"
    )
        ? normalizeDeniedPermissions(updateData.deniedPermissions)
        : normalizePermissionList(user.deniedPermissions || []);

    if (
        Object.prototype.hasOwnProperty.call(updateData, "roleId") &&
        updateData.roleId === null &&
        !Object.prototype.hasOwnProperty.call(updateData, "deniedPermissions")
    ) {
        deniedPermissions = [];
    }

    if (nextRole) {
        const allowedPermissionSet = new Set(
            normalizePermissionList(nextRole.permissions || [])
        );

        if (Object.prototype.hasOwnProperty.call(updateData, "deniedPermissions")) {
            const invalidOverrides = deniedPermissions.filter(
                (permission) => !allowedPermissionSet.has(permission)
            );

            if (invalidOverrides.length) {
                throw new AppError(
                    "Denied permissions must come from the user's assigned role permissions",
                    400
                );
            }
        } else {
            deniedPermissions = deniedPermissions.filter(
                (permission) => allowedPermissionSet.has(permission)
            );
        }
    } else if (deniedPermissions.length) {
        throw new AppError("Denied permissions require an assigned role", 400);
    }

    user.deniedPermissions = deniedPermissions;
    await user.save();

    if (updateData.status && updateData.status !== USER_STATUS.ACTIVE) {
        await Session.updateMany(
            { userId, isRevoked: false },
            { $set: { isRevoked: true } }
        );
    }

    const updatedFields = getUpdatedFieldNames(updateData);

    if (updatedFields.length) {
        await recordAuditLog({
            userId: actedBy,
            action: AUDIT_ACTION.USER_UPDATED,
            entity: "User",
            entityId: user._id,
            metadata: { updatedFields },
        });
    }

    if (updateData.status) {
        await recordAuditLog({
            userId: actedBy,
            action: AUDIT_ACTION.USER_STATUS_UPDATED,
            entity: "User",
            entityId: user._id,
            metadata: { status: updateData.status },
        });
    }

    if (Object.prototype.hasOwnProperty.call(updateData, "roleId")) {
        await recordAuditLog({
            userId: actedBy,
            action: updateData.roleId
                ? AUDIT_ACTION.ROLE_ASSIGNED
                : AUDIT_ACTION.ROLE_REMOVED,
            entity: "User",
            entityId: user._id,
            metadata: { roleId: updateData.roleId },
        });
    }

    if (Object.prototype.hasOwnProperty.call(updateData, "deniedPermissions")) {
        await recordAuditLog({
            userId: actedBy,
            action: AUDIT_ACTION.USER_PERMISSION_OVERRIDES_UPDATED,
            entity: "User",
            entityId: user._id,
            metadata: { deniedPermissions },
        });
    }

    return attachAccessProfile(user);
}

export async function deleteUser(userId) {
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    await Session.deleteMany({ userId });

    return true;
}