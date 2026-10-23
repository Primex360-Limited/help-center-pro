import { AppError } from "../../../shared/errors/AppError.js";
import {
    appendTicketCallLog,
    createTicketEvent,
    findTicketByPublicId,
    listTicketEvents,
    listTicketMessages
} from "../ticket.repository.js";
import {
    CALL_ACTOR,
    CALL_DIRECTION,
    CALL_EVENT_TYPE,
    MESSAGE_TYPE,
    SENDER_TYPE,
    TICKET_CHANNEL,
    TICKET_EVENT_TYPE,
    TICKET_STATUS
} from "../ticket.constants.js";
import {
    mapLegacyTicketMessageToEventResponse,
    mapTicketEventResponse
} from "../helpers/map-ticket-event-response.js";

function channelToEventType(channel) {
    if (channel === TICKET_CHANNEL.EMAIL) {
        return TICKET_EVENT_TYPE.EMAIL;
    }

    if (channel === TICKET_CHANNEL.PHONE) {
        return TICKET_EVENT_TYPE.CALL;
    }

    return TICKET_EVENT_TYPE.CHAT;
}

function buildCustomerActor(customer = {}) {
    return {
        type: SENDER_TYPE.CUSTOMER,
        customerId: customer.customerId,
        name: customer.customerName,
        email: customer.customerEmail,
        phone: customer.customerPhone,
        ip: customer.customerIp
    };
}

function buildAgentActor(actor) {
    return {
        type: SENDER_TYPE.AGENT,
        userId: actor.userId,
        name: actor.name,
        email: actor.email
    };
}

function compactObject(value) {
    return Object.fromEntries(
        Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null)
    );
}

export function buildTicketEventPayload(data = {}, actor, customer = {}) {
    const channel = data.channel || TICKET_CHANNEL.CHAT;
    const type = data.type || channelToEventType(channel);
    const hasCustomerIdentity = Boolean(
        customer.customerId ||
        customer.customerEmail ||
        customer.customerPhone ||
        customer.customerName ||
        customer.customerIp
    );

    if (type === TICKET_EVENT_TYPE.EMAIL || channel === TICKET_CHANNEL.EMAIL) {
        const email = {
            subject: data.email?.subject || data.title,
            body: data.email?.body || data.description,
            fromEmail: data.email?.fromEmail || customer.customerEmail || actor.email,
            toEmail: data.email?.toEmail || actor.email
        };
        const fromActorEmail = email.fromEmail?.toLowerCase() === actor.email?.toLowerCase();
        const createdBy = data.email?.senderType || (
            fromActorEmail || !hasCustomerIdentity ? SENDER_TYPE.AGENT : SENDER_TYPE.CUSTOMER
        );

        return {
            type: TICKET_EVENT_TYPE.EMAIL,
            channel: TICKET_CHANNEL.EMAIL,
            createdBy,
            metadata: {
                actor: createdBy === SENDER_TYPE.AGENT
                    ? buildAgentActor(actor)
                    : compactObject(buildCustomerActor(customer))
            },
            email
        };
    }

    if (type === TICKET_EVENT_TYPE.CALL || channel === TICKET_CHANNEL.PHONE) {
        const direction = data.call?.direction || CALL_DIRECTION.INBOUND;
        const callActor = direction === CALL_DIRECTION.OUTBOUND
            ? CALL_ACTOR.AGENT
            : CALL_ACTOR.CUSTOMER;

        return {
            type: TICKET_EVENT_TYPE.CALL,
            channel: TICKET_CHANNEL.PHONE,
            createdBy: callActor,
            metadata: {
                actor: callActor === CALL_ACTOR.AGENT
                    ? buildAgentActor(actor)
                    : compactObject(buildCustomerActor(customer))
            },
            call: {
                duration: data.call?.duration,
                recordingUrl: data.call?.recordingUrl,
                initialLog: {
                    eventType: CALL_EVENT_TYPE.CALL_INITIATED,
                    actor: callActor,
                    direction
                }
            }
        };
    }

    const senderType = data.chat?.senderType || (
        hasCustomerIdentity ? SENDER_TYPE.CUSTOMER : SENDER_TYPE.AGENT
    );

    return {
        type: TICKET_EVENT_TYPE.CHAT,
        channel: TICKET_CHANNEL.CHAT,
        createdBy: senderType,
        metadata: {
            actor: senderType === SENDER_TYPE.AGENT
                ? buildAgentActor(actor)
                : compactObject(buildCustomerActor(customer))
        },
        chat: {
            message: data.chat?.message || data.description,
            senderType
        }
    };
}

export function buildTicketLogEvent({ action, content, actor, metadata = {} }) {
    return {
        type: TICKET_EVENT_TYPE.LOG,
        channel: TICKET_CHANNEL.CHAT,
        createdBy: SENDER_TYPE.AGENT,
        metadata: {
            action,
            content,
            ...metadata,
            actor: buildAgentActor(actor)
        }
    };
}

export function buildAgentChatEvent(content, actor, metadata = {}) {
    return {
        type: TICKET_EVENT_TYPE.CHAT,
        channel: TICKET_CHANNEL.CHAT,
        createdBy: SENDER_TYPE.AGENT,
        metadata: {
            ...metadata,
            actor: buildAgentActor(actor)
        },
        chat: {
            message: content,
            senderType: SENDER_TYPE.AGENT
        }
    };
}

async function getTicketOrThrow(ticketId, tenantId) {
    const ticket = await findTicketByPublicId(ticketId, {
        ...(tenantId ? { tenantId } : {})
    });

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    if (tenantId && ticket.tenantId && ticket.tenantId !== tenantId) {
        throw new AppError("Ticket not found", 404);
    }

    return ticket;
}

export async function addEventToTicket(ticketId, data, actor) {
    const ticket = await getTicketOrThrow(ticketId, actor?.tenantId || data?.tenantId);
    const event = buildTicketEventPayload(data, actor, {
        customerId: ticket.customerId,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        customerPhone: ticket.customerPhone,
        customerIp: ticket.customerIp
    });
    event.metadata = {
        ...(event.metadata || {}),
        ...(data.eventMetadata || {}),
        actor: event.metadata?.actor || data.eventMetadata?.actor
    };
    const now = new Date();
    const isCustomerEvent = event.createdBy === SENDER_TYPE.CUSTOMER;
    const isAgentEvent = event.createdBy === SENDER_TYPE.AGENT;
    const ticketWorkflowData = {
        updatedByUserId: actor.userId,
        updatedByName: actor.name,
        updatedByEmail: actor.email,
        ...(isCustomerEvent ? { lastCustomerResponseAt: now } : {}),
        ...(isAgentEvent ? { lastAgentResponseAt: now } : {}),
        ...(isCustomerEvent && ticket.status === TICKET_STATUS.WAITING_FOR_REPLY
            ? {
                status: TICKET_STATUS.OPEN,
                waitingForCustomerAt: null
            }
            : {})
    };
    const statusHistoryData = isCustomerEvent && ticket.status === TICKET_STATUS.WAITING_FOR_REPLY
        ? {
            oldStatus: ticket.status,
            newStatus: TICKET_STATUS.OPEN,
            changedByUserId: actor.userId,
            changedByName: actor.name,
            changedByEmail: actor.email
        }
        : null;

    return mapTicketEventResponse(
        await createTicketEvent({
            ticketRefId: ticket.id,
            event,
            ticketWorkflowData,
            statusHistoryData
        })
    );
}

export async function addCallLogToTicketCall(callId, log) {
    return appendTicketCallLog({
        callId,
        log
    });
}

export async function getTicketThread(ticketId, tenantId = null) {
    const ticket = await getTicketOrThrow(ticketId, tenantId);
    const [events, legacyMessagesResult] = await Promise.all([
        listTicketEvents(ticket.id),
        listTicketMessages({
            ticketRefId: ticket.id,
            messageType: MESSAGE_TYPE.MESSAGE
        })
    ]);

    const legacyMessageIdsInEvents = new Set(
        events
            .map((event) => event.metadata?.legacyMessageId)
            .filter(Boolean)
    );

    const eventTimeline = events
        .filter((event) => event.metadata?.messageType !== MESSAGE_TYPE.INTERNAL_NOTE)
        .map(mapTicketEventResponse);
    const legacyTimeline = legacyMessagesResult.messages
        .filter((message) => !legacyMessageIdsInEvents.has(message.id))
        .map(mapLegacyTicketMessageToEventResponse);

    return [...eventTimeline, ...legacyTimeline].sort(
        (first, second) => new Date(first.createdAt) - new Date(second.createdAt)
    );
}
