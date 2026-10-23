import { AppError } from "../../../shared/errors/AppError.js";
import prisma from "../../../database/prisma/client.js";
import { USER_STATUS } from "../../../shared/constants/system.js";
import {
    findTicketByPublicId,
    pickQueuedTicketWithHistory,
    updateTicketAssignmentWithHistory
} from "../ticket.repository.js";
import { mapTicketResponse } from "../helpers/map-ticket-response.js";
import {
    canReceiveTicketAssignment,
    getAssignableUserSnapshot,
    isUserOnline,
    listOnlineAssignableUsers
} from "../helpers/ticket-assignee.js";
import { getUsers } from "../../users/user.service.js";
import { buildUserSnapshot } from "../ticket.utils.js";
import { TICKET_STATUS } from "../ticket.constants.js";
import { buildTicketLogEvent } from "../timeline/timeline.service.js";
import { requireTenantId } from "../helpers/tenant-scope.js";

function buildAssignmentHistory(ticket, assignmentSnapshot, actor, transferReason) {
    return {
        previousAssignedToUserId: ticket.assignedToUserId,
        previousAssignedToName: ticket.assignedToName,
        previousAssignedToEmail: ticket.assignedToEmail,
        newAssignedToUserId: assignmentSnapshot.userId,
        newAssignedToName: assignmentSnapshot.name,
        newAssignedToEmail: assignmentSnapshot.email,
        assignedByUserId: actor.userId,
        assignedByName: actor.name,
        assignedByEmail: actor.email,
        transferReason
    };
}

function actorTenantId(actor) {
    return requireTenantId(
        { tenantId: actor?.tenantId },
        "Workspace context is required for ticket assignment"
    );
}

export async function assignTicket(ticketId, assignedToUserId, actor, transferReason = undefined) {
    const tenantId = actorTenantId(actor);
    const ticket = await findTicketByPublicId(ticketId, { tenantId });

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    if (ticket.assignedToUserId === assignedToUserId) {
        throw new AppError("Ticket is already assigned to this user", 409);
    }

    const assignmentSnapshot = await getAssignableUserSnapshot(assignedToUserId, tenantId);
    const updatedTicket = await updateTicketAssignmentWithHistory({
        ticketRefId: ticket.id,
        assignment: assignmentSnapshot,
        updatedBy: actor,
        history: buildAssignmentHistory(ticket, assignmentSnapshot, actor, transferReason)
    });

    return mapTicketResponse(updatedTicket);
}

export async function transferTicket(ticketId, assignedToUserId, transferReason, actor, options = {}) {
    const tenantId = actorTenantId(actor);
    const reason = transferReason.trim();
    const ticket = await findTicketByPublicId(ticketId, { tenantId });

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    if (ticket.assignedToUserId === assignedToUserId) {
        throw new AppError("Ticket is already assigned to this user", 409);
    }

    const assignmentSnapshot = await getAssignableUserSnapshot(assignedToUserId, tenantId);
    let updatedTicket = await updateTicketAssignmentWithHistory({
        ticketRefId: ticket.id,
        assignment: assignmentSnapshot,
        updatedBy: actor,
        history: buildAssignmentHistory(ticket, assignmentSnapshot, actor, reason),
        logEvent: buildTicketLogEvent({
            action: "TICKET_TRANSFERRED",
            actor,
            content: {
                message: "Ticket transferred to another agent",
                reason,
                notifyCustomer: Boolean(options.notifyCustomer),
                addInternalNote: Boolean(options.addInternalNote),
                keepAsFollower: Boolean(options.keepAsFollower),
                from: ticket.assignedToUserId
                    ? {
                        userId: ticket.assignedToUserId,
                        name: ticket.assignedToName,
                        email: ticket.assignedToEmail
                    }
                    : null,
                to: assignmentSnapshot
            }
        })
    });

    // Optional priority change requested from the transfer dialog.
    if (options.priority && options.priority !== updatedTicket.priority) {
        updatedTicket = await prisma.ticket.update({
            where: { id: updatedTicket.id },
            data: { priority: options.priority }
        });
    }

    return mapTicketResponse(updatedTicket);
}

/**
 * All assignable agents with live presence + open-ticket load — powers the
 * premium Transfer dialog (Available / Busy / Offline, open ticket counts).
 * Strictly scoped to the caller's workspace.
 */
export async function listAssignableAgents(tenantId) {
    const scopedTenantId = requireTenantId(
        { tenantId },
        "Workspace context is required to list assignable agents"
    );
    const users = await getUsers(scopedTenantId);
    const assignable = users.filter(
        (user) => user.status === USER_STATUS.ACTIVE && canReceiveTicketAssignment(user)
    );

    const load = await prisma.ticket.groupBy({
        by: ["assignedToUserId"],
        where: {
            tenantId: scopedTenantId,
            assignedToUserId: { in: assignable.map((u) => u.id) },
            status: { notIn: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] }
        },
        _count: { _all: true }
    });
    const loadByUser = new Map(load.map((row) => [row.assignedToUserId, row._count._all]));

    return assignable.map((user) => {
        const openTickets = loadByUser.get(user.id) || 0;
        const online = isUserOnline(user);
        return {
            ...buildUserSnapshot(user),
            role: user?.role?.name || null,
            expertise: user?.role?.name || "Support",
            isOnline: online,
            presence: !online ? "offline" : openTickets >= 5 ? "busy" : "available",
            openTickets,
            lastSeenAt: user?.lastSeenAt || user?.lastLoginAt || null
        };
    });
}

export async function pickQueuedTicket(ticketId, actor) {
    const tenantId = actorTenantId(actor);
    const ticket = await findTicketByPublicId(ticketId, { tenantId });

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    if (ticket.status !== TICKET_STATUS.QUEUED) {
        throw new AppError("Only queued tickets can be picked from queue", 400);
    }

    if (ticket.assignedToUserId) {
        throw new AppError("Ticket has already been picked by another agent", 409);
    }

    const assignmentSnapshot = await getAssignableUserSnapshot(actor.userId, tenantId);
    const updatedTicket = await pickQueuedTicketWithHistory({
        ticketRefId: ticket.id,
        assignment: assignmentSnapshot,
        updatedBy: actor,
        statusHistory: {
            oldStatus: ticket.status,
            newStatus: TICKET_STATUS.OPEN,
            changedByUserId: actor.userId,
            changedByName: actor.name,
            changedByEmail: actor.email
        },
        assignmentHistory: buildAssignmentHistory(
            ticket,
            assignmentSnapshot,
            actor,
            "Picked from queue"
        ),
        logEvent: buildTicketLogEvent({
            action: "TICKET_PICKED_FROM_QUEUE",
            actor,
            content: {
                message: "Ticket picked from queue",
                pickedBy: assignmentSnapshot
            }
        })
    });

    return mapTicketResponse(updatedTicket);
}

export async function getOnlineAssignableAgents(tenantId) {
    return listOnlineAssignableUsers(tenantId);
}
