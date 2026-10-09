import { AppError } from "../../../shared/errors/AppError.js";
import { TICKET_STATUS } from "../ticket.constants.js";
import { findTicketByPublicId, updateTicketStatusWithHistory } from "../ticket.repository.js";
import { isValidStatusTransition } from "./status.rules.js";
import { mapTicketResponse } from "../helpers/map-ticket-response.js";

export async function updateTicketStatus(ticketId, status, actor) {
    const ticket = await findTicketByPublicId(ticketId);

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    if (!isValidStatusTransition(ticket.status, status)) {
        throw new AppError(
            `Invalid ticket status transition from ${ticket.status} to ${status}`,
            400
        );
    }

    const updatedTicket = await updateTicketStatusWithHistory({
        ticketRefId: ticket.id,
        status,
        updatedBy: actor,
        ticketWorkflowData: {
            waitingForCustomerAt: status === TICKET_STATUS.WAITING_FOR_REPLY ? new Date() : null
        },
        history: {
            oldStatus: ticket.status,
            newStatus: status,
            changedByUserId: actor.userId,
            changedByName: actor.name,
            changedByEmail: actor.email
        }
    });

    return mapTicketResponse(updatedTicket);
}
