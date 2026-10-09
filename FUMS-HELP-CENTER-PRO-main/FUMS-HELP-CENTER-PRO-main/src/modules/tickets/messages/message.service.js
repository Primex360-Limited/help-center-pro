import { AppError } from "../../../shared/errors/AppError.js";
import { createTicketMessageWithEvent, findTicketByPublicId, listTicketMessages } from "../ticket.repository.js";
import { buildPaginationMeta, getPagination } from "../ticket.utils.js";
import { MESSAGE_TYPE } from "../ticket.constants.js";
import { mapTicketMessageResponse } from "../helpers/map-ticket-response.js";
import { buildAgentChatEvent } from "../timeline/timeline.service.js";

async function getTicketOrThrow(ticketId) {
    const ticket = await findTicketByPublicId(ticketId);

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    return ticket;
}

export async function sendTicketMessage(ticketId, content, actor, messageType = MESSAGE_TYPE.MESSAGE) {
    const ticket = await getTicketOrThrow(ticketId);

    const trimmedContent = content.trim();
    const message = await createTicketMessageWithEvent({
        ticketRefId: ticket.id,
        messageData: {
            senderUserId: actor.userId,
            senderName: actor.name,
            senderEmail: actor.email,
            messageType,
            content: trimmedContent
        },
        event: buildAgentChatEvent(trimmedContent, actor, { messageType })
    });

    return mapTicketMessageResponse({
        ...message,
        ticket: { ticketId: ticket.ticketId }
    });
}

export async function getTicketMessages(ticketId, query = {}, messageType = MESSAGE_TYPE.MESSAGE) {
    const ticket = await getTicketOrThrow(ticketId);
    const pagination = getPagination(query);
    const { messages, total } = await listTicketMessages({
        ticketRefId: ticket.id,
        messageType,
        skip: pagination.skip,
        take: pagination.limit
    });

    return {
        messages: messages.map(mapTicketMessageResponse),
        meta: buildPaginationMeta({
            page: pagination.page,
            limit: pagination.limit,
            total
        })
    };
}
