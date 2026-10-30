import { TENANT_ROLE, isSuperAdminRoleName } from "../../../shared/constants/roles.js";
import { isSuperAdminUser } from "../../roles/role.service.js";

/**
 * Workspace admins (and platform super admins) see every ticket.
 * Regular agents only see the open queue (unassigned) plus tickets assigned to them.
 */
export function canViewAllWorkspaceTickets(user) {
    if (!user) return false;
    if (isSuperAdminUser(user)) return true;
    const roleName = user.role?.name || "";
    if (isSuperAdminRoleName(roleName)) return true;
    return roleName === TENANT_ROLE.ADMIN;
}

/**
 * Narrow a Prisma `where` so agents cannot browse other agents' assigned work.
 * Admins keep the original filter unchanged.
 */
export function applyTicketVisibilityFilter(where = {}, user) {
    if (canViewAllWorkspaceTickets(user)) {
        return where;
    }

    const userId = user?.id || user?.userId || null;
    const visibility = {
        OR: [
            { assignedToUserId: null },
            ...(userId ? [{ assignedToUserId: userId }] : [])
        ]
    };

    if (!where || Object.keys(where).length === 0) {
        return visibility;
    }

    return { AND: [where, visibility] };
}

/** True when this user may open the given ticket row. */
export function canAccessTicketRecord(ticket, user) {
    if (!ticket || !user) return false;
    if (canViewAllWorkspaceTickets(user)) return true;
    if (!ticket.assignedToUserId) return true;
    const userId = user.id || user.userId;
    return ticket.assignedToUserId === userId;
}

export default {
    canViewAllWorkspaceTickets,
    applyTicketVisibilityFilter,
    canAccessTicketRecord
};
