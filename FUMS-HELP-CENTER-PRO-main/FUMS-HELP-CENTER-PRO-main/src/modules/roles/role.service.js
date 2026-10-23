import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { PERMISSION_CATALOG } from "../../shared/constants/permissions.js";
import { AUDIT_ACTION, USER_TYPE } from "../../shared/constants/system.js";
import { PROVIDER_ROLE, isSuperAdminRoleName } from "../../shared/constants/roles.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import { normalizePermissionKey } from "../../shared/utils/permissionKey.js";

/** Only catalog keys may be granted on a role — never invent capabilities. */
const CATALOG_PERMISSION_KEYS = new Set(
    PERMISSION_CATALOG.map((entry) => entry.key)
);

/**
 * Role + permission service (Postgres / Prisma, Phase-1 multi-tenancy).
 *
 * Differences from the legacy Mongo implementation:
 *  - Permissions are relational (`RolePermission` join table) instead of an
 *    embedded string array, so `role.permissions` is flattened to keys here and
 *    every consumer only ever sees `string[]`.
 *  - Roles and users are tenant-scoped. `tenantId === undefined` means
 *    "unscoped" (provider/super-admin view across every workspace),
 *    `tenantId === null` means "provider-scope rows only", and a UUID string
 *    means "that one workspace".
 *  - Super admin is no longer detected by role *name* but by `userType`, which
 *    survives renaming of the provider role.
 */

export const PROVIDER_SCOPE = null;

/** Prisma include used everywhere a user needs its role + permission keys. */
export const USER_ROLE_INCLUDE = Object.freeze({
    role: { include: { permissions: { include: { permission: true } } } }
});

export function uniqueStrings(values = []) {
    return [...new Set(values.map((value) => value?.toString()).filter(Boolean))];
}

/**
 * Normalize a list of permission keys. Non-string entries (e.g. raw
 * `RolePermission` rows that were not flattened first) are dropped rather than
 * coerced into `"[object Object]"`.
 */
export function normalizePermissionList(permissions = []) {
    return [
        ...new Set(
            permissions
                .map((permission) =>
                    typeof permission === "string"
                        ? normalizePermissionKey(permission)
                        : null
                )
                .filter(Boolean)
        )
    ];
}

/**
 * Flatten a Prisma role (with `permissions: RolePermission[]`) or an already
 * flattened summary into a sorted, de-duplicated list of permission keys.
 */
export function flattenRolePermissionKeys(role) {
    if (!role || !Array.isArray(role.permissions)) {
        return [];
    }

    const keys = role.permissions
        .map((entry) => {
            if (typeof entry === "string") {
                return entry;
            }

            return entry?.permission?.key || null;
        })
        .filter(Boolean);

    return normalizePermissionList(keys);
}

export function buildRoleSummary(role) {
    if (!role) {
        return null;
    }

    return {
        id: role.id ?? null,
        name: role.name,
        description: role.description ?? null,
        permissions: flattenRolePermissionKeys(role)
    };
}

/** Resolve permission keys for a user document in either Prisma or legacy shape. */
export function getRolePermissionKeys(user) {
    if (Array.isArray(user?.role?.permissions)) {
        return flattenRolePermissionKeys(user.role);
    }

    return normalizePermissionList(user?.roleId?.permissions || []);
}

export function isProviderUser(user) {
    return user?.userType === USER_TYPE.PROVIDER;
}

export function isSuperAdminUser(user) {
    if (isProviderUser(user)) {
        return true;
    }

    const roleName = user?.role?.name || user?.roleId?.name;

    return isSuperAdminRoleName(roleName);
}

export function getEffectivePermissionsFromUser(user) {
    const rolePermissions = getRolePermissionKeys(user);
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

export async function findUserWithRole(userId, client = prisma) {
    if (!userId) {
        return null;
    }

    return client.user.findUnique({
        where: { id: userId },
        include: USER_ROLE_INCLUDE
    });
}

/**
 * Shape returned to the API for any user: sanitized user fields plus the
 * resolved access profile (`role`, `isSuperAdmin`, `allowedPermissions`, ...).
 */
export function buildUserAccessProfile(user) {
    if (!user) {
        return null;
    }

    const role = buildRoleSummary(user.role);
    const deniedPermissions = normalizePermissionList(user.deniedPermissions || []);

    return {
        role,
        roleId: role?.id || null,
        isProvider: isProviderUser(user),
        isSuperAdmin: isSuperAdminUser(user),
        allowedPermissions: getEffectivePermissionsFromUser(user),
        deniedPermissions
    };
}

/**
 * Build the Prisma `where` fragment for a tenant scope.
 *  - `undefined` -> no tenant filter at all (provider/admin view)
 *  - `null`      -> provider-scope rows (`tenantId IS NULL`)
 *  - UUID string -> that single workspace
 */
function roleScopeWhere(tenantId) {
    return tenantId === undefined ? {} : { tenantId };
}

/** Flatten a Prisma role row into the API shape (permissions as string keys). */
function toRoleView(role) {
    if (!role) {
        return null;
    }

    return {
        ...role,
        permissions: flattenRolePermissionKeys(role)
    };
}

/**
 * Resolve permission keys to `Permission.id`s.
 * Fail closed: keys outside `PERMISSION_CATALOG` are rejected so a role can
 * never grant capabilities beyond the product access model.
 */
async function resolvePermissionIds(permissionKeys, client = prisma) {
    const keys = normalizePermissionList(permissionKeys);

    if (!keys.length) {
        return [];
    }

    const unknown = keys.filter((key) => !CATALOG_PERMISSION_KEYS.has(key));
    if (unknown.length) {
        throw new AppError(
            `Unknown permission${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`,
            400
        );
    }

    const existing = await client.permission.findMany({
        where: { key: { in: keys } }
    });

    const permissionByKey = new Map(
        existing.map((permission) => [permission.key, permission])
    );

    const permissionIds = [];

    for (const key of keys) {
        let permission = permissionByKey.get(key);

        if (!permission) {
            permission = await client.permission.create({
                data: { key, category: key.split(":")[0] || null }
            });
            permissionByKey.set(key, permission);
        }

        permissionIds.push(permission.id);
    }

    return permissionIds;
}

/**
 * Reconcile a role's `RolePermission` rows to exactly `permissionIds`.
 *
 * `permissionId` is a `uuid`, so an empty target must be handled with a plain
 * `{ roleId }` delete instead of a `notIn: ["__none__"]` sentinel (Postgres
 * would reject the non-UUID literal).
 */
async function syncRolePermissions(client, roleId, permissionIds) {
    await client.rolePermission.deleteMany({
        where: permissionIds.length
            ? { roleId, permissionId: { notIn: permissionIds } }
            : { roleId }
    });

    if (!permissionIds.length) {
        return;
    }

    await client.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true
    });
}

async function loadRoleWithPermissions(roleId, tenantId, client = prisma) {
    const role = await client.role.findFirst({
        where: { id: roleId, ...roleScopeWhere(tenantId) },
        include: { permissions: { include: { permission: true } } }
    });

    if (!role) {
        throw new AppError("Role not found", 404);
    }

    return role;
}

export async function createRole({
    name,
    description,
    permissions,
    tenantId = PROVIDER_SCOPE,
    createdBy = null
}) {
    const normalizedName = String(name || "").trim();

    if (!normalizedName) {
        throw new AppError("Role name is required", 400);
    }

    const scopedTenantId = tenantId ?? null;

    const existingRole = await prisma.role.findFirst({
        where: { name: normalizedName, tenantId: scopedTenantId },
        select: { id: true }
    });

    if (existingRole) {
        throw new AppError("Role already exists", 409);
    }

    const permissionIds = await resolvePermissionIds(permissions);

    const role = await prisma.role.create({
        data: {
            name: normalizedName,
            description: description ?? null,
            tenantId: scopedTenantId,
            isSystem: false,
            permissions: {
                create: permissionIds.map((permissionId) => ({ permissionId }))
            }
        },
        include: { permissions: { include: { permission: true } } }
    });

    await recordAuditLog({
        tenantId: role.tenantId,
        userId: createdBy,
        action: AUDIT_ACTION.ROLE_CREATED,
        entity: "Role",
        entityId: role.id,
        metadata: {
            name: role.name,
            permissions: flattenRolePermissionKeys(role)
        }
    });

    return toRoleView(role);
}

export async function getRoles(tenantId) {
    const roles = await prisma.role.findMany({
        where: roleScopeWhere(tenantId),
        include: { permissions: { include: { permission: true } } },
        orderBy: { createdAt: "desc" }
    });

    return roles.map(toRoleView);
}

export async function getRoleById(roleId, tenantId) {
    const role = await loadRoleWithPermissions(roleId, tenantId);

    return toRoleView(role);
}

/**
 * After a role's permission set changes, drop any `deniedPermissions` entries
 * that the role no longer grants — otherwise a stale deny would silently block
 * the permission if it were ever re-granted.
 */
async function pruneDeniedPermissions(roleId, allowedPermissionKeys) {
    const allowedPermissionSet = new Set(allowedPermissionKeys);

    const users = await prisma.user.findMany({
        where: { roleId },
        select: { id: true, deniedPermissions: true }
    });

    for (const user of users) {
        const currentDenied = user.deniedPermissions || [];
        const nextDeniedPermissions = normalizePermissionList(currentDenied).filter(
            (permission) => allowedPermissionSet.has(permission)
        );

        if (nextDeniedPermissions.length === currentDenied.length) {
            continue;
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { deniedPermissions: nextDeniedPermissions }
        });
    }
}

export async function updateRole(roleId, data, actedBy = null, tenantId = undefined) {
    const role = await loadRoleWithPermissions(roleId, tenantId);
    const normalizedName =
        data.name === undefined ? undefined : String(data.name).trim();

    if (data.name !== undefined && !normalizedName) {
        throw new AppError("Role name is required", 400);
    }

    if (normalizedName !== undefined) {
        const duplicateRole = await prisma.role.findFirst({
            where: {
                name: normalizedName,
                tenantId: role.tenantId,
                id: { not: role.id }
            },
            select: { id: true }
        });

        if (duplicateRole) {
            throw new AppError("Role name already exists", 409);
        }
    }

    const permissionIds =
        data.permissions === undefined
            ? null
            : await resolvePermissionIds(data.permissions);

    await prisma.$transaction(async (tx) => {
        const updateData = {};

        if (normalizedName !== undefined) {
            updateData.name = normalizedName;
        }

        if (data.description !== undefined) {
            updateData.description = data.description ?? null;
        }

        if (Object.keys(updateData).length) {
            await tx.role.update({ where: { id: role.id }, data: updateData });
        }

        if (permissionIds) {
            await syncRolePermissions(tx, role.id, permissionIds);
        }
    });

    const updatedRole = await loadRoleWithPermissions(role.id);

    if (permissionIds) {
        await pruneDeniedPermissions(
            role.id,
            flattenRolePermissionKeys(updatedRole)
        );
    }

    await recordAuditLog({
        tenantId: updatedRole.tenantId,
        userId: actedBy,
        action: AUDIT_ACTION.ROLE_UPDATED,
        entity: "Role",
        entityId: updatedRole.id,
        metadata: {
            updatedFields: Object.keys(data),
            ...(permissionIds
                ? { permissions: flattenRolePermissionKeys(updatedRole) }
                : {})
        }
    });

    return toRoleView(updatedRole);
}

export async function assignRoleToUser({
    userId,
    roleId,
    actedBy = null,
    tenantId = undefined
}) {
    const user = await prisma.user.findFirst({
        where: { id: userId, ...roleScopeWhere(tenantId) },
        select: { id: true, deniedPermissions: true }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const role = await loadRoleWithPermissions(roleId, tenantId);
    const allowedPermissionSet = new Set(flattenRolePermissionKeys(role));

    await prisma.user.update({
        where: { id: user.id },
        data: {
            roleId: role.id,
            deniedPermissions: normalizePermissionList(
                user.deniedPermissions
            ).filter((permission) => allowedPermissionSet.has(permission))
        }
    });

    await recordAuditLog({
        tenantId: role.tenantId,
        userId: actedBy,
        action: AUDIT_ACTION.ROLE_ASSIGNED,
        entity: "User",
        entityId: user.id,
        metadata: { targetUserId: user.id, roleId: role.id }
    });

    const updatedUser = await findUserWithRole(user.id);

    return {
        user: updatedUser,
        profile: buildUserAccessProfile(updatedUser)
    };
}

export async function clearRoleFromUser(userId, actedBy = null) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, roleId: true, tenantId: true }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { roleId: null }
    });

    await recordAuditLog({
        tenantId: user.tenantId,
        userId: actedBy,
        action: AUDIT_ACTION.ROLE_REMOVED,
        entity: "User",
        entityId: user.id,
        metadata: { targetUserId: user.id, roleId: user.roleId }
    });

    return findUserWithRole(user.id);
}

export async function getUserRole(userId) {
    const user = await findUserWithRole(userId);

    return buildRoleSummary(user?.role);
}

export async function getUserBasePermissionKeys(userId) {
    const user = await findUserWithRole(userId);

    return flattenRolePermissionKeys(user?.role);
}

export async function getUserDeniedPermissionKeys(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { deniedPermissions: true }
    });

    return normalizePermissionList(user?.deniedPermissions || []);
}

export async function getUserPermissions(userId) {
    const user = await findUserWithRole(userId);

    if (!user) {
        return [];
    }

    return getEffectivePermissionsFromUser(user);
}

export async function getUserAccessProfile(userId) {
    const user = await findUserWithRole(userId);

    if (!user) {
        return null;
    }

    const profile = buildUserAccessProfile(user);

    return {
        ...(profile.role ? { role: profile.role } : {}),
        isProvider: profile.isProvider,
        isSuperAdmin: profile.isSuperAdmin,
        allowedPermissions: profile.allowedPermissions,
        ...(profile.deniedPermissions.length
            ? { deniedPermissions: profile.deniedPermissions }
            : {})
    };
}
