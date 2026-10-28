import { AppError } from "../../../shared/errors/AppError.js";
import prisma from "../../../database/prisma/client.js";
import { createTicket } from "../../tickets/ticket.service.js";
import { findTicketByPublicId } from "../../tickets/ticket.repository.js";
import { addEventToTicket } from "../../tickets/timeline/timeline.service.js";
import { getTicketMessages, sendTicketMessage } from "../../tickets/messages/message.service.js";
import {
    MESSAGE_TYPE,
    SENDER_TYPE,
    TICKET_CHANNEL,
    TICKET_PRIORITY
} from "../../tickets/ticket.constants.js";

const WIDGET_ACTOR = Object.freeze({
    userId: "system:widget-api",
    name: "Widget API",
    email: "widget-api@system.local"
});

const WIDGET_SECRET_AGENT = Object.freeze({
    userId: "system:widget-secret-agent",
    name: "Support agent",
    email: "support-agent@helpcentre.local"
});

const OPEN_CHAT_STATUSES = Object.freeze([
    "QUEUED",
    "OPEN",
    "PENDING",
    "WAITING_FOR_REPLY"
]);

/**
 * Prefer continuing an open live-chat ticket for the same visitor email so
 * Live Chat does not flood with duplicate threads from every widget open.
 */
function openChatTicketWhere(tenantId, visitorEmail) {
    return {
        tenantId,
        customerEmail: { equals: visitorEmail, mode: "insensitive" },
        status: { in: [...OPEN_CHAT_STATUSES] },
        OR: [
            { events: { some: { channel: TICKET_CHANNEL.CHAT } } },
            { title: { startsWith: "Live chat" } }
        ]
    };
}

async function findReusableChatTicket(tenantId, visitorEmail) {
    return prisma.ticket.findFirst({
        where: openChatTicketWhere(tenantId, visitorEmail),
        orderBy: { updatedAt: "desc" }
    });
}

/** Close older open chat threads for the same visitor so Live Chat stays tidy. */
async function collapseDuplicateOpenChats(tenantId, visitorEmail, keepTicketId) {
    await prisma.ticket.updateMany({
        where: {
            ...openChatTicketWhere(tenantId, visitorEmail),
            ticketId: { not: keepTicketId }
        },
        data: {
            status: "RESOLVED",
            updatedAt: new Date()
        }
    });
}

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

    const existing = await findReusableChatTicket(tenantId, visitorEmail);
    if (existing) {
        await collapseDuplicateOpenChats(tenantId, visitorEmail, existing.ticketId);
        await addEventToTicket(
            existing.ticketId,
            {
                customerEmail: visitorEmail,
                customerName: visitorName,
                customerPhone: visitorPhone || existing.customerPhone,
                tenantId,
                channel: TICKET_CHANNEL.CHAT,
                chat: {
                    message: initialMessage,
                    senderType: SENDER_TYPE.CUSTOMER
                },
                eventMetadata: {
                    widgetMode: mode,
                    source: "public_widget_api",
                    resumedSession: true
                }
            },
            { ...WIDGET_ACTOR, tenantId }
        );

        return {
            ticketId: existing.ticketId,
            customerId: existing.customerId || visitorEmail,
            mode,
            resumed: true
        };
    }

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
        mode,
        resumed: false
    };
}

export async function sendWidgetMessage({
    tenantId,
    mode,
    keyKind = "public",
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

    // Secret key posts as the agent so external integrations (and this test
    // harness) can deliver replies into the same ticket the visitor opened.
    if (keyKind === "secret") {
        const agentMessage = await sendTicketMessage(
            ticket.ticketId,
            content,
            { ...WIDGET_SECRET_AGENT, tenantId },
            MESSAGE_TYPE.MESSAGE
        );
        return {
            ticketId: ticket.ticketId,
            messageId: agentMessage.id,
            mode,
            role: "agent"
        };
    }

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
        mode,
        role: "customer"
    };
}

/**
 * Poll the live-chat thread for an external chatbot / widget.
 * Returns customer + agent messages so replies appear on the visitor side.
 */
export async function listWidgetMessages({
    tenantId,
    mode,
    ticketId,
    after = null,
    limit = 100
}) {
    const ticket = await findTicketByPublicId(ticketId, { tenantId });
    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    const capped = Math.min(Math.max(Number(limit) || 100, 1), 200);
    // Always take the newest window so agent replies are never truncated
    // behind older customer messages when the thread is long.
    const result = await getTicketMessages(
        ticket.ticketId,
        { page: 1, limit: capped, latest: true },
        MESSAGE_TYPE.MESSAGE,
        tenantId
    );

    const afterMs = after ? new Date(after).getTime() : null;
    const messages = (result.messages || [])
        .filter((message) => {
            if (!afterMs || Number.isNaN(afterMs)) return true;
            return new Date(message.createdAt).getTime() > afterMs;
        })
        .map((message) => {
            const senderId = String(message?.sender?.userId || "");
            const isCustomerActor =
                !senderId ||
                senderId === "system:widget-api" ||
                senderId === "system:chat-widget";
            const isAgent = !isCustomerActor;
            return {
                id: message.id,
                ticketId: ticket.ticketId,
                role: isAgent ? "agent" : "customer",
                senderType: isAgent ? SENDER_TYPE.AGENT : SENDER_TYPE.CUSTOMER,
                name: message?.sender?.name || (isAgent ? "Support agent" : "Customer"),
                content: message.content,
                createdAt: message.createdAt
            };
        });

    const latestAt =
        messages.length > 0
            ? messages[messages.length - 1].createdAt
            : result.messages?.length
              ? result.messages[result.messages.length - 1].createdAt
              : null;

    return {
        ticketId: ticket.ticketId,
        mode,
        status: ticket.status,
        workspace: {
            id: ticket.tenantId,
            name: undefined,
            slug: undefined
        },
        messages,
        latestAt
    };
}

export async function getWidgetSession({ tenant, mode, keyKind }) {
    return {
        mode,
        keyKind,
        workspace: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug
        }
    };
}

export default {
    createWidgetVisitor,
    sendWidgetMessage,
    listWidgetMessages,
    getWidgetSession
};
