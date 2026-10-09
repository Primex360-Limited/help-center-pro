import Role from "../../database/model/role.model.js";
import {
    ADMIN_PERMISSIONS,
    AGENT_PERMISSIONS,
    DEFAULT_SYSTEM_PERMISSIONS,
    SYSTEM_ROLE
} from "../../shared/constants/system.js";
import { normalizePermissionList } from "./role.service.js";

const DEFAULT_ROLES = [
    {
        name: SYSTEM_ROLE.SUPER_ADMIN,
        description: "Platform super administrator with full access",
        permissions: DEFAULT_SYSTEM_PERMISSIONS
    },
    {
        name: SYSTEM_ROLE.ADMIN,
        description: "Tenant administrator — manage users, roles, and tickets",
        permissions: ADMIN_PERMISSIONS
    },
    {
        name: SYSTEM_ROLE.AGENT,
        description: "Support agent — handle assigned tickets and customer replies",
        permissions: AGENT_PERMISSIONS
    }
];

async function upsertRole({ name, description, permissions }) {
    const normalizedPermissions = normalizePermissionList(permissions);
    let role = await Role.findOne({ name });

    if (!role) {
        role = await Role.create({
            name,
            description,
            permissions: normalizedPermissions
        });
        return { role, created: true };
    }

    const mergedPermissions = normalizePermissionList([
        ...(role.permissions || []),
        ...normalizedPermissions
    ]);

    const needsUpdate =
        role.description !== description ||
        mergedPermissions.length !== (role.permissions || []).length ||
        mergedPermissions.some((permission) => !(role.permissions || []).includes(permission));

    if (needsUpdate) {
        role.description = description;
        role.permissions = mergedPermissions;
        await role.save();
    }

    return { role, created: false };
}

export async function seedDefaultRoles() {
    const results = [];

    for (const roleDef of DEFAULT_ROLES) {
        results.push(await upsertRole(roleDef));
    }

    return results;
}

export default seedDefaultRoles;
