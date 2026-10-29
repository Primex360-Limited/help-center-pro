import { AppError } from "../../../shared/errors/AppError.js";
import prisma from "../../../database/prisma/client.js";
import { createTicket } from "../../tickets/ticket.service.js";
import { findTicketByPublicId } from "../../tickets/ticket.repository.js";
import { addEventToTicket } from "../../tickets/timeline/timeline.service.js";
import { getTicketMessages } from "../../tickets/messages/message.service.js";
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

function buildGuestVisitorEmail() {
    return `guest.${Date.now().toString(36)}.${Math.random()
        .toString(36)
        .slice(2, 8)}@visitor.local`;
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
    const hasEmail = Boolean(String(email || "").trim());
    const visitorEmail = hasEmail
        ? String(email).trim().toLowerCase()
        : buildGuestVisitorEmail();
    const visitorPhone = phone?.trim() || undefined;
    const visitorName =
        name?.trim() ||
        (hasEmail ? visitorEmail.split("@")[0] : visitorPhone || "Visitor");
    const initialMessage =
        message?.trim() ||
        `Chat started by ${visitorName} via widget (${mode})`;

    // Only resume when we have a real identity (email) — anonymous guests
    // always get a fresh thread.
    const existing = hasEmail
        ? await findReusableChatTicket(tenantId, visitorEmail)
        : null;
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
            resumed: true,
            anonymous: !hasEmail
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
                source: "public_widget_api",
                anonymous: !hasEmail
            }
        },
        { ...WIDGET_ACTOR, tenantId }
    );

    return {
        ticketId: ticket.ticketId,
        customerId: ticket.customer?.customerId || visitorEmail,
        mode,
        resumed: false,
        anonymous: !hasEmail
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
    phone,
    role = "customer"
}) {
    const ticket = await findTicketByPublicId(ticketId, { tenantId });
    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    const content = String(message).trim();
    const wantAgent =
        keyKind === "secret" && String(role || "customer").toLowerCase() === "agent";

    // Secret key + role:"agent" posts an agent bubble (automation / bot replies).
    // Everything else — including secret-key visitor traffic — is the customer,
    // so Live Chat keeps WhatsApp-style left bubbles for visitor messages.
    if (wantAgent) {
        const event = await addEventToTicket(
            ticket.ticketId,
            {
                tenantId,
                channel: TICKET_CHANNEL.CHAT,
                chat: {
                    message: content,
                    senderType: SENDER_TYPE.AGENT
                },
                eventMetadata: {
                    widgetMode: mode,
                    source: "public_widget_api",
                    role: "agent"
                }
            },
            { ...WIDGET_SECRET_AGENT, tenantId }
        );
        return {
            ticketId: ticket.ticketId,
            eventId: event.id,
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
            const explicit = String(
                message?.role || message?.senderType || message?.sender?.type || ""
            ).toUpperCase();
            const senderId = String(message?.sender?.userId || "");
            const isAgent =
                explicit === "AGENT" ||
                (Boolean(senderId) &&
                    !senderId.startsWith("system:") &&
                    explicit !== "CUSTOMER");
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
