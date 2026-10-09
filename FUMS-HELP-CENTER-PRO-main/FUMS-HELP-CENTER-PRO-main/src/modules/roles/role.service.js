import Role from "../../database/model/role.model.js";
import User from "../../database/model/user.model.js";
import { AppError } from "../../shared/errors/AppError.js";
import { AUDIT_ACTION, SYSTEM_ROLE } from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import { normalizePermissionKey } from "../../shared/utils/permissionKey.js";

function uniqueStrings(values = []) {
    return [...new Set(values.map((value) => value?.toString()).filter(Boolean))];
}

export function normalizePermissionList(permissions = []) {
    return uniqueStrings(permissions.map((permission) => normalizePermissionKey(permission)));
}

export function buildRoleSummary(role) {
    if (!role) {
        return null;
    }

    return {
        id: role._id?.toString?.() || role.id,
        name: role.name,
        description: role.description,
        permissions: normalizePermissionList(role.permissions || [])
    };
}

export function isSuperAdminUser(user) {
    const roleName = user?.role?.name || user?.roleId?.name;

    return roleName?.trim().toLowerCase() === SYSTEM_ROLE.SUPER_ADMIN.toLowerCase();
}

export function getEffectivePermissionsFromUser(user) {
    const rolePermissions = normalizePermissionList(user?.roleId?.permissions || []);
    const deniedPermissions = new Set(
        normalizePermissionList(user?.deniedPermissions || [])
    );

    if (!rolePermissions.length) {
        return [];
    }

    return rolePermissions.filter(
        (permission) => !deniedPermissions.has(permission)
    );
}

async function getUserWithRole(userId, fields = "") {
    const query = User.findById(userId).populate(
        "roleId",
        "name description permissions"
    );

    if (fields) {
        query.select(fields);
    }

    return query;
}

export async function createRole({
    name,
    description,
    permissions,
    createdBy = null
}) {
    const normalizedName = name.trim();
    const normalizedPermissions = normalizePermissionList(permissions);

    const existingRole = await Role.findOne({ name: normalizedName });

    if (existingRole) {
        throw new AppError("Role already exists", 409);
    }

    const role = await Role.create({
        name: normalizedName,
        description,
        permissions: normalizedPermissions
    });

    await recordAuditLog({
        userId: createdBy,
        action: AUDIT_ACTION.ROLE_CREATED,
        entity: "Role",
        entityId: role._id,
        metadata: {
            name: role.name,
            permissions: role.permissions
        }
    });

    return role;
}

export async function getRoles() {
    const roles = await Role.find().sort({ createdAt: -1 }).lean();

    return roles.map((role) => ({
        ...role,
        permissions: normalizePermissionList(role.permissions || [])
    }));
}

export async function getRoleById(roleId) {
    const role = await Role.findById(roleId).lean();

    if (!role) {
        throw new AppError("Role not found", 404);
    }

    return {
        ...role,
        permissions: normalizePermissionList(role.permissions || [])
    };
}

export async function updateRole(roleId, data, actedBy = null) {
    const role = await Role.findById(roleId);

    if (!role) {
        throw new AppError("Role not found", 404);
    }

    if (data.name !== undefined) {
        const normalizedName = data.name.trim();
        const existingRole = await Role.findOne({
            name: normalizedName,
            _id: { $ne: roleId }
        }).lean();

        if (existingRole) {
            throw new AppError("Role name already exists", 409);
        }
        role.name = normalizedName;
    }
    if (data.description !== undefined) {
        role.description = data.description;
    }
    if (data.permissions !== undefined) {
        role.permissions = normalizePermissionList(data.permissions);
    }
    await role.save();

    if (data.permissions !== undefined) {
        const allowedPermissionSet = new Set(role.permissions || []);
        const users = await User.find({ roleId: role._id }).select("deniedPermissions")
        for (const user of users) {
            const nextDeniedPermissions = normalizePermissionList(
                user.deniedPermissions || []
            ).filter((permission) => allowedPermissionSet.has(permission));

            if(
                nextDeniedPermissions.length !== (user.deniedPermissions || []).length
            ){
                user.deniedPermissions = nextDeniedPermissions;
                await user.save();
            }

        }
    }

    await recordAuditLog({
        userId: actedBy,
        action: AUDIT_ACTION.ROLE_UPDATED,
        entity: "Role",
        entityId: role._id,
        metadata: {
            updatedFields: Object.keys(data),
            ...(data.permissions !== undefined 
                ? { permissions: role.permissions } 
                : {})
        }
    });

    return role;

}


export async function assignRoleToUser({ userId, roleId, actedBy = null }) {
    const [user, role] = await Promise.all([
        User.findById(userId),
        Role.findById(roleId)
    ]);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    if (!role) {
        throw new AppError("Role not found", 404);
    }

    user.roleId = role._id;
    user.deniedPermissions = normalizePermissionList(user.deniedPermissions).filter(
        (permission) => role.permissions.includes(permission)
    );
    await user.save();

    await recordAuditLog({
        userId: actedBy,
        action: AUDIT_ACTION.ROLE_ASSIGNED,
        entity: "User",
        entityId: user._id,
        metadata: { targetUserId: userId, roleId: role._id }
    });

    return getUserWithRole(userId);
}

export async function clearRoleFromUser({ userId, actedBy = null }) {
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    user.roleId = null;
    user.deniedPermissions = [];
    await user.save();

    await recordAuditLog({
        userId: actedBy,
        action: AUDIT_ACTION.ROLE_REMOVED,
        entity: "User",
        entityId: user._id,
        metadata: { targetUserId: userId }
    });

    return true;
}

export async function getUserRole(userId) {
    const user = await getUserWithRole(userId, "roleId");

    return buildRoleSummary(user?.roleId);
}

export async function getUserBasePermissionKeys(userId) {
    const user = await getUserWithRole(userId, "roleId");

    return normalizePermissionList(user?.roleId?.permissions || []);
}

export async function getUserDeniedPermissionKeys(userId) {
    const user = await User.findById(userId).select("deniedPermissions").lean();

    return normalizePermissionList(user?.deniedPermissions || []);
}

export async function getUserPermissions(userId) {
    const user = await getUserWithRole(userId, "roleId deniedPermissions");

    return getEffectivePermissionsFromUser(user);
}

export async function getUserAccessProfile(userId) {
    const user = await getUserWithRole(userId, "roleId deniedPermissions");
    const role = buildRoleSummary(user?.roleId);
    const deniedPermissions = normalizePermissionList(user?.deniedPermissions || []);

    return {
        ...(role ? { role } : {}),
        isSuperAdmin: isSuperAdminUser(user),
        allowedPermissions: getEffectivePermissionsFromUser(user),
        ...(deniedPermissions.length ? { deniedPermissions } : {})
    };
}
