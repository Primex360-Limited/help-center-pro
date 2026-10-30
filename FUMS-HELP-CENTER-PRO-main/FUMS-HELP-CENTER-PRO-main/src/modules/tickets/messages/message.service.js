import { AppError } from "../../../shared/errors/AppError.js";
import { createTicketMessageWithEvent, findTicketByPublicId, listTicketEvents, listTicketMessages } from "../ticket.repository.js";
import { buildPaginationMeta, getPagination } from "../ticket.utils.js";
import { MESSAGE_TYPE, SENDER_TYPE } from "../ticket.constants.js";
import { mapTicketMessageResponse } from "../helpers/map-ticket-response.js";
import { buildAgentChatEvent } from "../timeline/timeline.service.js";
import { requireTenantId } from "../helpers/tenant-scope.js";
import { canAccessTicketRecord } from "../helpers/ticket-visibility.js";

async function getTicketOrThrow(ticketId, tenantId, viewer = null) {
    const scopedTenantId = requireTenantId({ tenantId });
    const ticket = await findTicketByPublicId(ticketId, { tenantId: scopedTenantId });

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    if (viewer && !canAccessTicketRecord(ticket, viewer)) {
        throw new AppError("Ticket not found", 404);
    }

    return ticket;
}

export async function sendTicketMessage(ticketId, content, actor, messageType = MESSAGE_TYPE.MESSAGE) {
    const ticket = await getTicketOrThrow(
        ticketId,
        actor?.tenantId,
        actor?.user || null
    );

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

function chatEventAsMessage(event, ticket) {
    // Prisma relation shape: event.chat.message — also accept nested payloads.
    const rawContent =
        (typeof event?.chat?.message === "string" && event.chat.message) ||
        (typeof event?.chat?.content === "string" && event.chat.content) ||
        (typeof event?.metadata?.message === "string" && event.metadata.message) ||
        "";
    const content = String(rawContent).trim();
    if (!content) return null;
    if (event?.metadata?.messageType === MESSAGE_TYPE.INTERNAL_NOTE) return null;
    // Only chat (and legacy rows without type) belong in the live-chat pane.
    if (event?.type && event.type !== "CHAT") return null;

    const actor = event?.metadata?.actor && typeof event.metadata.actor === "object"
        ? event.metadata.actor
        : {};
    const senderType = event?.chat?.senderType || event?.createdBy;
    const isCustomer =
        senderType === SENDER_TYPE.CUSTOMER ||
        String(senderType).toUpperCase() === "CUSTOMER" ||
        actor.type === SENDER_TYPE.CUSTOMER;

    return {
        id: event.id,
        ticketId: ticket.ticketId,
        senderType: isCustomer ? SENDER_TYPE.CUSTOMER : SENDER_TYPE.AGENT,
        role: isCustomer ? "customer" : "agent",
        sender: isCustomer
            ? {
                userId: null,
                type: SENDER_TYPE.CUSTOMER,
                name: actor.name || ticket.customerName || "Customer",
                email: actor.email || ticket.customerEmail || ""
            }
            : {
                userId: actor.userId || null,
                type: SENDER_TYPE.AGENT,
                name: actor.name || "Agent",
                email: actor.email || ""
            },
        type: MESSAGE_TYPE.MESSAGE,
        content,
        createdAt: event.createdAt
    };
}

function descriptionAsMessage(ticket) {
    const content = String(ticket?.description || "").trim();
    if (!content) return null;
    return {
        id: `desc:${ticket.ticketId}`,
        ticketId: ticket.ticketId,
        senderType: SENDER_TYPE.CUSTOMER,
        role: "customer",
        sender: {
            userId: null,
            type: SENDER_TYPE.CUSTOMER,
            name: ticket.customerName || "Customer",
            email: ticket.customerEmail || ""
        },
        type: MESSAGE_TYPE.MESSAGE,
        content,
        createdAt: ticket.createdAt || ticket.updatedAt || new Date().toISOString()
    };
}

export async function getTicketMessages(
    ticketId,
    query = {},
    messageType = MESSAGE_TYPE.MESSAGE,
    tenantId = null,
    viewer = null
) {
    const ticket = await getTicketOrThrow(
        ticketId,
        tenantId ?? query.tenantId,
        viewer
    );
    const pagination = getPagination(query);
    const [{ messages }, events] = await Promise.all([
        listTicketMessages({
            ticketRefId: ticket.id,
            messageType
        }),
        // Always load timeline events — widget visitor messages live here,
        // not in TicketMessage (which requires an agent senderUserId).
        messageType === MESSAGE_TYPE.MESSAGE
            ? listTicketEvents(ticket.id)
            : Promise.resolve([])
    ]);

    const stored = messages.map(mapTicketMessageResponse);
    const storedIds = new Set(stored.map((message) => message.id));
    const fromWidget = events
        .filter((event) => {
            const legacyId = event?.metadata?.legacyMessageId;
            return !legacyId || !storedIds.has(legacyId);
        })
        .map((event) => chatEventAsMessage(event, ticket))
        .filter((message) => message && !storedIds.has(message.id));

    let combined = [...stored, ...fromWidget].sort(
        (first, second) => new Date(first.createdAt) - new Date(second.createdAt)
    );

    // Last resort: ticket.description is set from the first visitor message.
    if (!combined.length && messageType === MESSAGE_TYPE.MESSAGE) {
        const seed = descriptionAsMessage(ticket);
        if (seed) combined = [seed];
    }

    // `latest=true` returns the newest window (WhatsApp / live-chat style).
    // Default pagination remains oldest-first for classic ticket history.
    const wantLatest =
        query.latest === true ||
        query.latest === "true" ||
        query.latest === 1 ||
        query.latest === "1";
    let pageItems;
    if (wantLatest) {
        const end = combined.length;
        const start = Math.max(0, end - pagination.limit);
        pageItems = combined.slice(start, end);
    } else {
        pageItems = combined.slice(
            pagination.skip,
            pagination.skip + pagination.limit
        );
    }

    return {
        messages: pageItems,
        meta: buildPaginationMeta({
            page: pagination.page,
            limit: pagination.limit,
            total: combined.length
        })
    };
}
