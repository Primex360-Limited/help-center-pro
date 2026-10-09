import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";
import {
    findLatestActiveTicketByCustomerEmail,
    findTicketByPublicId,
    findTicketEventByEmailMetadata,
    listTicketEvents
} from "../ticket.repository.js";
import { createTicket } from "../ticket.service.js";
import { addEventToTicket, getTicketThread } from "../timeline/timeline.service.js";
import {
    SENDER_TYPE,
    TICKET_CHANNEL,
    TICKET_PRIORITY
} from "../ticket.constants.js";
import { mapTicketEventResponse } from "../helpers/map-ticket-event-response.js";
import {
    getReceivedEmail,
    sendSupportEmail,
    verifyResendWebhook
} from "./support-email.provider.js";
import {
    broadcastInboundEmail,
    broadcastTicketEvent
} from "../realtime/ticket-socket.service.js";
import { mapTicketResponse } from "../helpers/map-ticket-response.js";

const SYSTEM_EMAIL_ACTOR = Object.freeze({
    userId: "system:resend",
    name: "Resend Email Webhook",
    email: env.SUPPORT_EMAIL_FROM || env.EMAIL_FROM || "support@example.com"
});

function stripHtml(html = "") {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeEmail(email) {
    return email?.trim().toLowerCase() || null;
}

function parseAddress(value) {
    const raw = Array.isArray(value) ? value[0] : value;

    if (!raw) {
        return {
            email: null,
            name: null
        };
    }

    const match = raw.match(/^(.*?)<([^>]+)>$/);

    if (!match) {
        return {
            email: normalizeEmail(raw),
            name: null
        };
    }

    return {
        name: match[1].replace(/"/g, "").trim() || null,
        email: normalizeEmail(match[2])
    };
}

function extractTicketId(value = "") {
    return value.match(/\bTCKT-\d{8}-[A-F0-9]{6}\b/i)?.[0]?.toUpperCase() || null;
}

function getHeader(headers, key) {
    if (!headers) {
        return null;
    }

    const match = Object.entries(headers).find(
        ([headerKey]) => headerKey.toLowerCase() === key.toLowerCase()
    );

    return match?.[1] || null;
}

function buildEmailMetadata({
    direction,
    receivedEmail,
    webhookData,
    outboundEmail,
    inReplyTo,
    references
}) {
    return {
        email: {
            provider: "resend",
            direction,
            resendEmailId: receivedEmail?.id || webhookData?.email_id || outboundEmail?.id,
            messageId: receivedEmail?.message_id || webhookData?.message_id,
            inReplyTo,
            references,
            receivedAt: receivedEmail?.created_at || webhookData?.created_at,
            to: receivedEmail?.to || webhookData?.to,
            cc: receivedEmail?.cc || webhookData?.cc,
            bcc: receivedEmail?.bcc || webhookData?.bcc,
            attachments: receivedEmail?.attachments || webhookData?.attachments,
            hasHtml: Boolean(receivedEmail?.html)
        }
    };
}

function buildInboundEmailData(webhookData, receivedEmail) {
    const from = parseAddress(receivedEmail?.from || webhookData.from);
    const to = receivedEmail?.to || webhookData.to || [];
    const subject = receivedEmail?.subject || webhookData.subject || "New support email";
    const text = receivedEmail?.text || stripHtml(receivedEmail?.html || "") || webhookData.text || "";
    const body = text || "Customer sent an email with no text body.";
    const headers = receivedEmail?.headers || {};

    return {
        subject,
        body,
        html: receivedEmail?.html,
        fromEmail: from.email,
        fromName: from.name,
        toEmail: parseAddress(to).email || env.SUPPORT_EMAIL_FROM,
        inReplyTo: getHeader(headers, "in-reply-to"),
        references: getHeader(headers, "references")
    };
}

async function resolveEmailTicket({ subject, fromEmail, inReplyTo, references }) {
    const ticketId = extractTicketId(subject) || extractTicketId(inReplyTo) || extractTicketId(references);

    if (ticketId) {
        return findTicketByPublicId(ticketId);
    }

    const threadEvent = await findTicketEventByEmailMetadata({
        messageId: inReplyTo || references
    });

    if (threadEvent?.ticket) {
        return threadEvent.ticket;
    }

    return findLatestActiveTicketByCustomerEmail(fromEmail);
}

export async function processResendInboundEmailWebhook(req) {
    const event = verifyResendWebhook(req);

    if (event.type !== "email.received") {
        return {
            ignored: true,
            type: event.type
        };
    }

    const webhookData = event.data || {};
    const duplicateEvent = await findTicketEventByEmailMetadata({
        resendEmailId: webhookData.email_id,
        messageId: webhookData.message_id
    });

    if (duplicateEvent) {
        return {
            duplicate: true,
            ticket: duplicateEvent.ticket,
            event: mapTicketEventResponse(duplicateEvent)
        };
    }

    const receivedEmail = await getReceivedEmail(webhookData.email_id);
    const inboundEmail = buildInboundEmailData(webhookData, receivedEmail);

    if (!inboundEmail.fromEmail) {
        throw new AppError("Inbound support email is missing a sender address", 400);
    }

    const existingTicket = await resolveEmailTicket({
        subject: inboundEmail.subject,
        fromEmail: inboundEmail.fromEmail,
        inReplyTo: inboundEmail.inReplyTo,
        references: inboundEmail.references
    });
    const eventMetadata = buildEmailMetadata({
        direction: "INBOUND",
        receivedEmail,
        webhookData,
        inReplyTo: inboundEmail.inReplyTo,
        references: inboundEmail.references
    });

    if (existingTicket) {
        const eventResponse = await addEventToTicket(
            existingTicket.ticketId,
            {
                channel: TICKET_CHANNEL.EMAIL,
                customerName: inboundEmail.fromName || existingTicket.customerName,
                customerEmail: inboundEmail.fromEmail,
                email: {
                    subject: inboundEmail.subject,
                    body: inboundEmail.body,
                    fromEmail: inboundEmail.fromEmail,
                    toEmail: inboundEmail.toEmail,
                    senderType: SENDER_TYPE.CUSTOMER
                },
                eventMetadata
            },
            SYSTEM_EMAIL_ACTOR
        );
        const ticketResponse = mapTicketResponse(existingTicket);

        broadcastInboundEmail({
            ticket: ticketResponse,
            event: eventResponse,
            created: false
        });

        return {
            created: false,
            ticket: ticketResponse,
            event: eventResponse
        };
    }

    const ticket = await createTicket(
        {
            title: inboundEmail.subject,
            description: inboundEmail.body,
            priority: TICKET_PRIORITY.MEDIUM,
            customerName: inboundEmail.fromName || inboundEmail.fromEmail,
            customerEmail: inboundEmail.fromEmail,
            channel: TICKET_CHANNEL.EMAIL,
            email: {
                subject: inboundEmail.subject,
                body: inboundEmail.body,
                fromEmail: inboundEmail.fromEmail,
                toEmail: inboundEmail.toEmail,
                senderType: SENDER_TYPE.CUSTOMER
            },
            initialEventMetadata: eventMetadata
        },
        SYSTEM_EMAIL_ACTOR
    );
    const thread = await getTicketThread(ticket.ticketId);
    const initialEvent = thread[thread.length - 1] || null;

    broadcastInboundEmail({
        ticket,
        event: initialEvent,
        created: true
    });

    return {
        created: true,
        ticket,
        event: initialEvent
    };
}

export async function replyToTicketByEmail(ticketId, data, actor) {
    const ticket = await findTicketByPublicId(ticketId);

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    const toEmail = normalizeEmail(data.toEmail || ticket.customerEmail);

    if (!toEmail) {
        throw new AppError("Ticket does not have a customer email address", 400);
    }

    const events = await listTicketEvents(ticket.id);
    const latestEmailEvent = [...events].reverse().find(
        (event) => event.type === "EMAIL" && event.metadata?.email?.messageId
    );
    const inReplyTo = data.inReplyTo || latestEmailEvent?.metadata?.email?.messageId;
    const references = data.references || latestEmailEvent?.metadata?.email?.references || inReplyTo;
    const subject = data.subject || `Re: [${ticket.ticketId}] ${ticket.title}`;
    const body = data.body.trim();
    const outboundEmail = await sendSupportEmail({
        to: toEmail,
        subject,
        text: body,
        html: data.html,
        headers: {
            ...(inReplyTo ? { "In-Reply-To": inReplyTo } : {}),
            ...(references ? { References: references } : {})
        }
    });
    const event = await addEventToTicket(
        ticketId,
        {
            channel: TICKET_CHANNEL.EMAIL,
            email: {
                subject,
                body,
                fromEmail: env.SUPPORT_EMAIL_FROM,
                toEmail,
                senderType: SENDER_TYPE.AGENT
            },
            eventMetadata: buildEmailMetadata({
                direction: "OUTBOUND",
                outboundEmail,
                inReplyTo,
                references
            })
        },
        actor
    );

    broadcastTicketEvent(ticketId, event, {
        source: "EMAIL",
        direction: "OUTBOUND"
    });

    return {
        email: outboundEmail,
        event
    };
}
