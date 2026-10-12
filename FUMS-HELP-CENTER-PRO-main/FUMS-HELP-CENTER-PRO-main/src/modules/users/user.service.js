import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { AUDIT_ACTION, USER_STATUS } from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import { normalizePermissionKey } from "../../shared/utils/permissionKey.js";
import {
    USER_ROLE_INCLUDE,
    buildUserAccessProfile,
    flattenRolePermissionKeys,
    normalizePermissionList
} from "../roles/role.service.js";

/**
 * User administration service (Postgres / Prisma, Phase-1 multi-tenancy).
 *
 * Tenant scope convention — identical to `role.service.js`:
 *   undefined -> unscoped (provider-wide view across every workspace)
 *   null      -> provider-scope rows only (`tenantId IS NULL`)
 *   uuid      -> that single workspace
 *
 * Users are created by registration (`auth.service`) or by accepting an
 * invitation (`invitation.service`); this module only reads and mutates them.
 */

/** Prisma `where` fragment for a tenant scope. */
function userScopeWhere(tenantId) {
    return tenantId === undefined ? {} : { tenantId };
}

function normalizeEmail(email) {
    return String(email || "").toLowerCase().trim();
}

/** Drop secrets (`passwordHash`) before a user is returned to the API. */
function sanitizeUser(user) {
    if (!user) {
        return null;
    }

    const { passwordHash, ...rest } = user;

    return rest;
}

function normalizeDeniedPermissions(permissions = []) {
    return [
        ...new Set(
            permissions
                .map((permission) => normalizePermissionKey(permission))
                .filter(Boolean)
        )
    ];
}

function getUpdatedFieldNames(updateData = {}) {
    return Object.keys(updateData).filter(
        (key) => updateData[key] !== undefined
    );
}

/**
 * Sanitized user plus the resolved access profile (`role`, `isSuperAdmin`,
 * `allowedPermissions`, ...) — the shape every consumer of this service gets.
 */
export function toUserView(user) {
    if (!user) {
        return null;
    }

    const profile = buildUserAccessProfile(user);

    return {
        ...sanitizeUser(user),
        role: profile.role,
        roleId: profile.role?.id ?? user.roleId ?? null,
        isProvider: profile.isProvider,
        isSuperAdmin: profile.isSuperAdmin,
        allowedPermissions: profile.allowedPermissions,
        deniedPermissions: profile.deniedPermissions
    };
}

/** Load one user inside a tenant scope or fail with 404. */
export async function loadScopedUser(userId, tenantId = undefined, client = prisma) {
    const user = await client.user.findFirst({
        where: { id: userId, ...userScopeWhere(tenantId) },
        include: USER_ROLE_INCLUDE
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    return user;
}

/**
 * Emails are unique per workspace (`@@unique([tenantId, email])`), so the same
 * address may legitimately exist once per tenant *and* once for the provider
 * (`tenantId IS NULL`). Anything outside that scope — and any second occurrence
 * inside it — is a conflict.
 */
export async function assertEmailAvailable(
    email,
    { tenantId = null, excludeUserId = null, client = prisma } = {}
) {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
        return null;
    }

    const existing = await client.user.findFirst({
        where: { email: normalizedEmail, tenantId: tenantId ?? null },
        select: { id: true, tenantId: true }
    });

    if (existing && existing.id !== excludeUserId) {
        throw new AppError("A user with this email already exists", 409);
    }

    return existing ?? null;
}

/** Tenant-aware email lookup used by invitations and admin flows. */
export async function findUserByEmailInScope(email, tenantId = null, client = prisma) {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
        return null;
    }

    return client.user.findFirst({
        where: { email: normalizedEmail, ...userScopeWhere(tenantId) },
        include: USER_ROLE_INCLUDE
    });
}

/**
 * List users inside a scope. Pass `undefined` (the default) for the
 * provider-wide view, `null` for provider accounts only, or a tenant UUID.
 */
export async function getUsers(tenantId = undefined) {
    const users = await prisma.user.findMany({
        where: userScopeWhere(tenantId),
        include: USER_ROLE_INCLUDE,
        orderBy: { createdAt: "desc" }
    });

    return users.map(toUserView);
}

/**
 * Workspace team list with live ticket counters for the Agents screen.
 * Stats are computed from Postgres tickets and never fabricated.
 */
export async function getUsersWithTicketStats(tenantId = undefined) {
    const users = await getUsers(tenantId);
    const userIds = users.map((user) => user.id).filter(Boolean);

    if (!userIds.length) {
        return users.map((user) => ({
            ...user,
            ticketStats: { assigned: 0, open: 0, resolved: 0 }
        }));
    }

    const grouped = await prisma.ticket.groupBy({
        by: ["assignedToUserId", "status"],
        where: { assignedToUserId: { in: userIds } },
        _count: { _all: true }
    });

    const statsByUser = new Map();

    for (const row of grouped) {
        if (!row.assignedToUserId) continue;
        const current = statsByUser.get(row.assignedToUserId) || {
            assigned: 0,
            open: 0,
            resolved: 0
        };
        const count = row._count?._all || 0;
        current.assigned += count;
        if (
            row.status === "OPEN" ||
            row.status === "QUEUED" ||
            row.status === "PENDING" ||
            row.status === "WAITING_FOR_REPLY"
        ) {
            current.open += count;
        }
        if (row.status === "RESOLVED" || row.status === "CLOSED") {
            current.resolved += count;
        }
        statsByUser.set(row.assignedToUserId, current);
    }

    return users.map((user) => ({
        ...user,
        ticketStats: statsByUser.get(user.id) || {
            assigned: 0,
            open: 0,
            resolved: 0
        }
    }));
}

export async function getUserById(userId, tenantId = undefined) {
    const user = await loadScopedUser(userId, tenantId);

    return toUserView(user);
}

/**
 * Resolve the role a user may be assigned. The role has to live in the *same*
 * scope as the target user — provider roles (`tenantId IS NULL`) for provider
 * accounts, workspace roles for workspace members — which blocks cross-tenant
 * privilege escalation.
 */
async function resolveAssignableRole(roleId, user, client = prisma) {
    const role = await client.role.findFirst({
        where: { id: roleId, tenantId: user.tenantId ?? null },
        include: { permissions: { include: { permission: true } } }
    });

    if (!role) {
        throw new AppError("Role not found", 404);
    }

    return role;
}

/**
 * Update a user's profile, status, role assignment and denied permissions.
 *
 * Preserves the legacy semantics: removing a role (`roleId: null`) also clears
 * the permission overrides, and denied permissions must always be a subset of
 * the currently assigned role's grants.
 */
export async function updateUser(
    userId,
    data,
    actedBy = null,
    tenantId = undefined
) {
    const user = await loadScopedUser(userId, tenantId);
    const updateData = { ...data };

    const hasRoleUpdate = Object.prototype.hasOwnProperty.call(
        updateData,
        "roleId"
    );
    const hasOverrideUpdate = Object.prototype.hasOwnProperty.call(
        updateData,
        "deniedPermissions"
    );
    let nextRole = user.role;

    if (hasRoleUpdate) {
        nextRole = updateData.roleId
            ? await resolveAssignableRole(updateData.roleId, user)
            : null;
    }

    const profileUpdate = {};
    for (const field of [
        "firstName",
        "lastName",
        "phoneNumber",
        "profileImage",
        "metadata",
        "status"
    ]) {
        if (updateData[field] !== undefined) {
            profileUpdate[field] = updateData[field];
        }
    }

    let deniedPermissions = hasOverrideUpdate
        ? normalizeDeniedPermissions(updateData.deniedPermissions)
        : normalizePermissionList(user.deniedPermissions || []);

    if (hasRoleUpdate && !updateData.roleId && !hasOverrideUpdate) {
        deniedPermissions = [];
    }

    if (nextRole) {
        const allowedPermissionSet = new Set(flattenRolePermissionKeys(nextRole));

        if (hasOverrideUpdate) {
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
            deniedPermissions = deniedPermissions.filter((permission) =>
                allowedPermissionSet.has(permission)
            );
        }
    } else if (deniedPermissions.length) {
        throw new AppError("Denied permissions require an assigned role", 400);
    }

    await prisma.user.update({
        where: { id: user.id },
        data: {
            ...profileUpdate,
            ...(hasRoleUpdate ? { roleId: nextRole?.id ?? null } : {}),
            deniedPermissions
        }
    });

    if (profileUpdate.status && profileUpdate.status !== USER_STATUS.ACTIVE) {
        await prisma.session.updateMany({
            where: { userId: user.id, isRevoked: false },
            data: { isRevoked: true }
        });
    }

    const updatedFields = getUpdatedFieldNames(updateData);

    if (updatedFields.length) {
        await recordAuditLog({
            tenantId: user.tenantId,
            userId: actedBy,
            action: AUDIT_ACTION.USER_UPDATED,
            entity: "User",
            entityId: user.id,
            metadata: { updatedFields }
        });
    }

    if (updateData.status) {
        await recordAuditLog({
            tenantId: user.tenantId,
            userId: actedBy,
            action: AUDIT_ACTION.USER_STATUS_UPDATED,
            entity: "User",
            entityId: user.id,
            metadata: { status: updateData.status }
        });
    }

    if (hasRoleUpdate) {
        await recordAuditLog({
            tenantId: user.tenantId,
            userId: actedBy,
            action: updateData.roleId
                ? AUDIT_ACTION.ROLE_ASSIGNED
                : AUDIT_ACTION.ROLE_REMOVED,
            entity: "User",
            entityId: user.id,
            metadata: {
                targetUserId: user.id,
                roleId: nextRole?.id ?? null
            }
        });
    }

    if (hasOverrideUpdate) {
        await recordAuditLog({
            tenantId: user.tenantId,
            userId: actedBy,
            action: AUDIT_ACTION.USER_PERMISSION_OVERRIDES_UPDATED,
            entity: "User",
            entityId: user.id,
            metadata: { deniedPermissions }
        });
    }

    const updatedUser = await loadScopedUser(user.id, tenantId);

    return toUserView(updatedUser);
}

/**
 * Hard-delete a user inside a scope.
 *
 * `Session`, `PasswordResetToken` and `VerificationToken` all cascade from the
 * `User` row. Invitations the user *sent* cannot cascade
 * (`AgentInvitation.invitedById` is a required foreign key), so they are
 * deleted in the same transaction — an invitation whose inviter no longer
 * exists is unusable anyway.
 */
export async function deleteUser(
    userId,
    actedBy = null,
    tenantId = undefined
) {
    const user = await prisma.user.findFirst({
        where: { id: userId, ...userScopeWhere(tenantId) },
        select: { id: true, email: true, tenantId: true }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    await prisma.$transaction([
        prisma.agentInvitation.deleteMany({ where: { invitedById: user.id } }),
        prisma.user.delete({ where: { id: user.id } })
    ]);

    await recordAuditLog({
        tenantId: user.tenantId,
        userId: actedBy,
        action: AUDIT_ACTION.USER_DELETED,
        entity: "User",
        entityId: user.id,
        metadata: { email: user.email }
    });

    return true;
}
