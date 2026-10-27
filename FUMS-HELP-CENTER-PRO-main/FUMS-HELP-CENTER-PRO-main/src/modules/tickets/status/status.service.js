import prisma from "../../../database/prisma/client.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { TICKET_STATUS } from "../ticket.constants.js";
import { findTicketByPublicId, updateTicketStatusWithHistory } from "../ticket.repository.js";
import { isValidStatusTransition } from "./status.rules.js";
import { mapTicketResponse } from "../helpers/map-ticket-response.js";
import { requireTenantId } from "../helpers/tenant-scope.js";
import { dispatchTicketStatusUpdatedWebhook } from "../../webhooks/webhook.dispatcher.js";

export async function updateTicketStatus(ticketId, status, actor) {
    const tenantId = requireTenantId({ tenantId: actor?.tenantId });
    const ticket = await findTicketByPublicId(ticketId, { tenantId });

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    if (ticket.status === status) {
        return mapTicketResponse(ticket);
    }

    if (!isValidStatusTransition(ticket.status, status)) {
        throw new AppError(
            `Invalid ticket status transition from ${ticket.status} to ${status}`,
            400
        );
    }

    const previousStatus = ticket.status;
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

    const dto = mapTicketResponse(updatedTicket);
    dispatchTicketStatusUpdatedWebhook(
        { ...updatedTicket, ...dto, tenantId },
        previousStatus
    );
    return dto;
}

export async function updateTicketPriority(ticketId, priority, actor) {
    const tenantId = requireTenantId({ tenantId: actor?.tenantId });
    const ticket = await findTicketByPublicId(ticketId, { tenantId });

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    if (ticket.priority === priority) {
        return mapTicketResponse(ticket);
    }

    const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
            priority,
            updatedByUserId: actor.userId,
            updatedByName: actor.name,
            updatedByEmail: actor.email
        }
    });

    return mapTicketResponse(updated);
}
