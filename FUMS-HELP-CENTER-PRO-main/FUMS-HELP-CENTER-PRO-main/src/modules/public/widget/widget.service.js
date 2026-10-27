import { AppError } from "../../../shared/errors/AppError.js";
import { createTicket } from "../../tickets/ticket.service.js";
import { findTicketByPublicId } from "../../tickets/ticket.repository.js";
import { addEventToTicket } from "../../tickets/timeline/timeline.service.js";
import {
    SENDER_TYPE,
    TICKET_CHANNEL,
    TICKET_PRIORITY
} from "../../tickets/ticket.constants.js";

const WIDGET_ACTOR = Object.freeze({
    userId: "system:widget-api",
    name: "Widget API",
    email: "widget-api@system.local"
});

export async function createWidgetVisitor({
    tenantId,
    mode,
    email,
    phone,
    name,
    message,
    customerIp = null
}) {
    const visitorEmail = String(email).trim().toLowerCase();
    const visitorName = name?.trim() || visitorEmail.split("@")[0];
    const visitorPhone = phone?.trim() || undefined;
    const initialMessage =
        message?.trim() ||
        `Chat started by ${visitorName} via widget (${mode})`;

    const ticket = await createTicket(
        {
            title: `Live chat — ${visitorName}`,
            description: initialMessage,
            priority: TICKET_PRIORITY.MEDIUM,
            tenantId,
            customerEmail: visitorEmail,
            customerPhone: visitorPhone,
            customerName: visitorName,
            ...(customerIp ? { customerIp } : {}),
            channel: TICKET_CHANNEL.CHAT,
            chat: {
                message: initialMessage,
                senderType: SENDER_TYPE.CUSTOMER
            },
            initialEventMetadata: {
                widgetMode: mode,
                source: "public_widget_api"
            }
        },
        { ...WIDGET_ACTOR, tenantId }
    );

    return {
        ticketId: ticket.ticketId,
        customerId: ticket.customer?.customerId || visitorEmail,
        mode
    };
}

export async function sendWidgetMessage({
    tenantId,
    mode,
    ticketId,
    message,
    email,
    name,
    phone
}) {
    const ticket = await findTicketByPublicId(ticketId, { tenantId });
    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    const content = String(message).trim();
    const event = await addEventToTicket(
        ticket.ticketId,
        {
            customerEmail: email || ticket.customerEmail,
            customerName: name || ticket.customerName,
            customerPhone: phone || ticket.customerPhone,
            tenantId,
            channel: TICKET_CHANNEL.CHAT,
            chat: {
                message: content,
                senderType: SENDER_TYPE.CUSTOMER
            },
            eventMetadata: {
                widgetMode: mode,
                source: "public_widget_api"
            }
        },
        { ...WIDGET_ACTOR, tenantId }
    );

    return {
        ticketId: ticket.ticketId,
        eventId: event.id,
        mode
    };
}

export default {
    createWidgetVisitor,
    sendWidgetMessage
};
