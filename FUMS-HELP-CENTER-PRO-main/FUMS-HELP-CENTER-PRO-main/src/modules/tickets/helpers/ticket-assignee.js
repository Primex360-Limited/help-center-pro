import { USER_STATUS } from "../../../shared/constants/system.js";
import { AppError } from "../../../shared/errors/AppError.js";
import {
    getRolePermissionKeys,
    isSuperAdminUser,
    normalizePermissionList
} from "../../roles/role.service.js";
import { getUserById, getUsers } from "../../users/user.service.js";
import { ONLINE_AGENT_WINDOW_MINUTES, TICKET_PERMISSIONS } from "../ticket.constants.js";
import { buildUserSnapshot } from "../ticket.utils.js";

/**
 * Canonical (`resource:action`) form of the keys that make a user assignable.
 * The ticket constants still use the legacy dot namespace, so both sides of the
 * comparison below are normalized or the intersection would always be empty.
 */
const ASSIGNABLE_TICKET_PERMISSIONS = normalizePermissionList([
    TICKET_PERMISSIONS.RECEIVE_ASSIGNMENT,
    TICKET_PERMISSIONS.ASSIGN,
    TICKET_PERMISSIONS.VIEW
]);

/**
 * Effective permission keys of a user: role permissions (Prisma join rows or
 * legacy string arrays) plus legacy `allowedPermissions` overrides, minus the
 * explicit `deniedPermissions` denials.
 */
function getUserPermissions(user) {
    const granted = normalizePermissionList([
        ...getRolePermissionKeys(user),
        ...(user?.allowedPermissions || [])
    ]);
    const deniedPermissions = new Set(
        normalizePermissionList(user?.deniedPermissions || [])
    );

    return granted.filter((permission) => !deniedPermissions.has(permission));
}

function getRoleName(user) {
    return user?.role?.name || user?.roleId?.name;
}

function getLastSeenAt(user) {
    return user?.lastSeenAt || user?.metadata?.lastSeenAt || user?.lastLoginAt || null;
}

function isRecentlySeen(user) {
    const lastSeenAt = getLastSeenAt(user);

    if (!lastSeenAt) {
        return false;
    }

    const lastSeenTime = new Date(lastSeenAt).getTime();

    if (Number.isNaN(lastSeenTime)) {
        return false;
    }

    const onlineWindowMs = ONLINE_AGENT_WINDOW_MINUTES * 60 * 1000;

    return Date.now() - lastSeenTime <= onlineWindowMs;
}

export function isUserOnline(user) {
    const presence = user?.metadata?.presence || user?.metadata?.presenceStatus;

    return user?.isOnline === true ||
        user?.metadata?.isOnline === true ||
        user?.metadata?.online === true ||
        presence === "online" ||
        isRecentlySeen(user);
}

export function canReceiveTicketAssignment(user) {
    if (isSuperAdminUser(user)) {
        return true;
    }

    const permissionSet = new Set(getUserPermissions(user));

    return ASSIGNABLE_TICKET_PERMISSIONS.some((permission) => permissionSet.has(permission));
}

export async function getAssignableUserSnapshot(userId) {
    const user = await getUserById(userId);

    if (user.status !== USER_STATUS.ACTIVE) {
        throw new AppError("Only active users can be assigned to tickets", 400);
    }

    if (!canReceiveTicketAssignment(user)) {
        throw new AppError("Only support agents or super admins can be assigned to tickets", 400);
    }

    return buildUserSnapshot(user);
}

export async function listOnlineAssignableUsers() {
    const users = await getUsers();

    return users
        .filter((user) => user.status === USER_STATUS.ACTIVE)
        .filter(canReceiveTicketAssignment)
        .filter(isUserOnline)
        .map((user) => ({
            ...buildUserSnapshot(user),
            role: getRoleName(user),
            isOnline: true,
            lastSeenAt: getLastSeenAt(user)
        }));
}
