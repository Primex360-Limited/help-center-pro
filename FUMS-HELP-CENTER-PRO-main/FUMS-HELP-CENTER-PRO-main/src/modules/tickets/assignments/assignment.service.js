import { AppError } from "../../../shared/errors/AppError.js";
import {
    findTicketByPublicId,
    pickQueuedTicketWithHistory,
    updateTicketAssignmentWithHistory
} from "../ticket.repository.js";
import { mapTicketResponse } from "../helpers/map-ticket-response.js";
import {
    getAssignableUserSnapshot,
    listOnlineAssignableUsers
} from "../helpers/ticket-assignee.js";
import { TICKET_STATUS } from "../ticket.constants.js";
import { buildTicketLogEvent } from "../timeline/timeline.service.js";

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

export async function assignTicket(ticketId, assignedToUserId, actor, transferReason = undefined) {
    const ticket = await findTicketByPublicId(ticketId);

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    if (ticket.assignedToUserId === assignedToUserId) {
        throw new AppError("Ticket is already assigned to this user", 409);
    }

    const assignmentSnapshot = await getAssignableUserSnapshot(assignedToUserId);
    const updatedTicket = await updateTicketAssignmentWithHistory({
        ticketRefId: ticket.id,
        assignment: assignmentSnapshot,
        updatedBy: actor,
        history: buildAssignmentHistory(ticket, assignmentSnapshot, actor, transferReason)
    });

    return mapTicketResponse(updatedTicket);
}

export async function transferTicket(ticketId, assignedToUserId, transferReason, actor) {
    const reason = transferReason.trim();
    const ticket = await findTicketByPublicId(ticketId);

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    if (ticket.assignedToUserId === assignedToUserId) {
        throw new AppError("Ticket is already assigned to this user", 409);
    }

    const assignmentSnapshot = await getAssignableUserSnapshot(assignedToUserId);
    const updatedTicket = await updateTicketAssignmentWithHistory({
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

    return mapTicketResponse(updatedTicket);
}

export async function pickQueuedTicket(ticketId, actor) {
    const ticket = await findTicketByPublicId(ticketId);

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    if (ticket.status !== TICKET_STATUS.QUEUED) {
        throw new AppError("Only queued tickets can be picked from queue", 400);
    }

    if (ticket.assignedToUserId) {
        throw new AppError("Ticket has already been picked by another agent", 409);
    }

    const assignmentSnapshot = await getAssignableUserSnapshot(actor.userId);
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

export async function getOnlineAssignableAgents() {
    return listOnlineAssignableUsers();
}
