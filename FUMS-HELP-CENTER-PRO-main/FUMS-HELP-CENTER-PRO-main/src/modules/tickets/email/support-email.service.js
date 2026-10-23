import { env } from "../../../config/env.js";
import prisma from "../../../database/prisma/client.js";
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
import { sendPlatformEmail, isPlatformSmtpConfigured } from "../../../shared/mail/platform-mailer.js";
import {
    broadcastInboundEmail,
    broadcastTicketEvent
} from "../realtime/ticket-socket.service.js";
import { mapTicketResponse } from "../helpers/map-ticket-response.js";
import { getDefaultEmailAccount } from "../../email/email-account.service.js";
import { sendReplyEmail } from "../../email/smtp/smtp.service.js";

const SYSTEM_EMAIL_ACTOR = Object.freeze({
    userId: "system:mailbox-sync",
    name: "Mailbox Sync",
    email: env.SUPPORT_EMAIL_FROM || env.EMAIL_FROM || "support@helpcentre-pro.local"
});

export function stripEmailHtml(html = "") {
    return String(html)
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function normalizeEmailAddress(email) {
    return email?.trim().toLowerCase() || null;
}

export function extractTicketPublicId(value = "") {
    return (
        String(value).match(/\bTK-\d{1,8}\b/i)?.[0]?.toUpperCase() ||
        String(value).match(/\bTCKT-\d{8}-[A-F0-9]{6}\b/i)?.[0]?.toUpperCase() ||
        null
    );
}

/** Shared email metadata stored on ticket events (used for dedupe/threading). */
export function buildEmailMetadata({
    direction,
    provider = "smtp",
    mailboxAccountId = null,
    messageId = null,
    inReplyTo = null,
    references = null,
    receivedAt = null,
    to = null,
    cc = null,
    attachments = null,
    hasHtml = false
}) {
    return {
        email: {
            provider,
            direction,
            mailboxAccountId,
            messageId: messageId || null,
            inReplyTo: inReplyTo || null,
            references: references || null,
            receivedAt: receivedAt || null,
            to: to || null,
            cc: cc || null,
            attachments: attachments || null,
            hasHtml: Boolean(hasHtml)
        }
    };
}

async function findEventByMessageId(messageId) {
    if (!messageId) return null;
    const variants = [
        messageId,
        String(messageId).replace(/^<|>$/g, ""),
        `<${String(messageId).replace(/^<|>$/g, "")}>`
    ];
    for (const variant of [...new Set(variants)]) {
        const found = await findTicketEventByEmailMetadata({ messageId: variant });
        if (found) return found;
    }
    return null;
}

async function resolveThreadTicket({
    subject,
    customerEmail,
    inReplyTo,
    references,
    tenantId
}) {
    const ticketId =
        extractTicketPublicId(subject) ||
        extractTicketPublicId(inReplyTo || "") ||
        extractTicketPublicId(references || "");
    if (ticketId) {
        const byPublicId = await findTicketByPublicId(ticketId, {
            ...(tenantId ? { tenantId } : {})
        });
        if (byPublicId) return byPublicId;
    }

    for (const ref of [inReplyTo, references]) {
        if (!ref) continue;
        for (const token of String(ref).split(/\s+/).filter(Boolean)) {
            const threadEvent = await findEventByMessageId(token);
            const ticket = threadEvent?.ticket;
            if (ticket && (!tenantId || ticket.tenantId === tenantId)) {
                return ticket;
            }
        }
    }

    if (customerEmail && tenantId) {
        return findLatestActiveTicketByCustomerEmail(customerEmail, tenantId);
    }
    return null;
}

/**
 * Ingest one message from a connected mailbox (IMAP sync).
 *
 * INBOUND  — customer wrote to the agent's mailbox: creates a ticket or
 *            appends to the matching thread.
 * OUTBOUND — the agent wrote to a customer directly from their own mail
 *            app (found in the Sent folder): appended to the matching
 *            ticket so HelpCentre Pro shows the full conversation.
 *
 * Messages are deduped by Message-ID, so mail sent from HelpCentre Pro
 * (which is filed into Sent by SMTP) is never imported twice.
 */
export async function ingestMailboxEmail({
    account,
    direction,
    fromEmail,
    fromName = null,
    toEmail,
    subject = "New support email",
    body = "",
    html = null,
    messageId = null,
    inReplyTo = null,
    references = null,
    receivedAt = null,
    attachments = null
}) {
    const from = normalizeEmailAddress(fromEmail);
    const to = normalizeEmailAddress(toEmail);
    const accountEmail = normalizeEmailAddress(account?.email);
    const text = body || stripEmailHtml(html || "") || "Customer sent an email with no text body.";

    if (!from) return { skipped: true, reason: "missing_sender" };
    if (direction === "INBOUND" && accountEmail && from === accountEmail) {
        return { skipped: true, reason: "own_message" };
    }

    const duplicate = await findEventByMessageId(messageId);
    if (duplicate) {
        return { duplicate: true, ticketId: duplicate.ticket?.ticketId || null };
    }

    const isOutbound = direction === "OUTBOUND";
    const customerEmail = isOutbound ? to : from;
    const tenantId = account?.tenantId || null;
    if (!tenantId) {
        return { skipped: true, reason: "mailbox_missing_tenant" };
    }

    const ticket = await resolveThreadTicket({
        subject,
        customerEmail,
        inReplyTo,
        references,
        tenantId
    });

    const eventMetadata = buildEmailMetadata({
        direction,
        provider: account?.provider || "smtp",
        mailboxAccountId: account?.id || null,
        messageId,
        inReplyTo,
        references,
        receivedAt,
        to: to ? [to] : null,
        attachments,
        hasHtml: Boolean(html)
    });

    const mailboxActor = account?.userId
        ? {
              userId: account.userId,
              name: account.displayName || account.email,
              email: account.email,
              tenantId
          }
        : { ...SYSTEM_EMAIL_ACTOR, tenantId };

    if (ticket) {
        const event = await addEventToTicket(
            ticket.ticketId,
            {
                tenantId,
                channel: TICKET_CHANNEL.EMAIL,
                customerName: isOutbound ? ticket.customerName : fromName || ticket.customerName,
                customerEmail: customerEmail || ticket.customerEmail,
                email: {
                    subject,
                    body: text,
                    fromEmail: from,
                    toEmail: to,
                    senderType: isOutbound ? SENDER_TYPE.AGENT : SENDER_TYPE.CUSTOMER
                },
                eventMetadata
            },
            isOutbound ? mailboxActor : { ...SYSTEM_EMAIL_ACTOR, tenantId }
        );

        broadcastTicketEvent(ticket.ticketId, event, {
            source: "EMAIL",
            direction
        });

        return { processed: true, action: "added_to_ticket", ticketId: ticket.ticketId, event };
    }

    if (isOutbound) {
        // Agent emailed someone who has no matching ticket — not support mail.
        return { skipped: true, reason: "no_matching_ticket" };
    }

    const newTicket = await createTicket(
        {
            title: subject,
            description: text,
            priority: TICKET_PRIORITY.MEDIUM,
            tenantId,
            customerName: fromName || from,
            customerEmail: from,
            channel: TICKET_CHANNEL.EMAIL,
            email: {
                subject,
                body: text,
                fromEmail: from,
                toEmail: to,
                senderType: SENDER_TYPE.CUSTOMER
            },
            initialEventMetadata: eventMetadata
        },
        { ...SYSTEM_EMAIL_ACTOR, tenantId }
    );
    const thread = await getTicketThread(newTicket.ticketId, tenantId);
    const initialEvent = thread[thread.length - 1] || null;

    broadcastInboundEmail({ ticket: newTicket, event: initialEvent, created: true });

    return { processed: true, action: "created_ticket", ticketId: newTicket.ticketId, event: initialEvent };
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function formatFromAddress(email, name) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanName = String(name || "").replace(/["<>]/g, "").trim();
    if (!cleanName) return cleanEmail;
    return `"${cleanName}" <${cleanEmail}>`;
}

/**
 * Preferred display sender for outbound customer email:
 * 1) Agent sender email (My profile)  2) Tenant support email (Settings)
 * 3) Platform EMAIL_FROM. Actual delivery goes through the agent's
 * connected mailbox whenever one exists (the mailbox address is then the
 * real From), otherwise through platform SMTP.
 */
async function resolveOutboundSender(actor) {
    const tenantId = actor?.tenantId || actor?.tenant_id || null;

    let agentEmail = null;
    let agentName = actor?.name || null;
    if (actor?.userId) {
        const user = await prisma.user.findUnique({
            where: { id: actor.userId },
            select: { firstName: true, lastName: true, email: true, metadata: true }
        });
        const meta =
            user?.metadata && typeof user.metadata === "object" && !Array.isArray(user.metadata)
                ? user.metadata
                : {};
        if (isValidEmail(meta.senderEmail)) {
            agentEmail = String(meta.senderEmail).trim().toLowerCase();
        }
        agentName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || agentName;
    }

    let tenantEmail = null;
    let tenantName = null;
    if (tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { name: true, settings: true }
        });
        const settings =
            tenant?.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
                ? tenant.settings
                : {};
        if (isValidEmail(settings.supportEmail)) {
            tenantEmail = String(settings.supportEmail).trim().toLowerCase();
        }
        tenantName = tenant?.name || null;
    }

    const platformEmail = normalizeEmailAddress(
        String(env.SUPPORT_EMAIL_FROM || env.EMAIL_FROM || "").match(/<([^>]+)>/)?.[1] ||
            env.SUPPORT_EMAIL_FROM ||
            env.EMAIL_FROM ||
            ""
    );

    if (agentEmail) {
        return { email: agentEmail, name: agentName || tenantName || "Support", source: "agent", platformEmail };
    }
    if (tenantEmail) {
        return { email: tenantEmail, name: tenantName || agentName || "Support", source: "tenant", platformEmail };
    }
    return {
        email: platformEmail || "support@helpcentre-pro.local",
        name: tenantName || agentName || "HelpCentre Pro Support",
        source: "platform",
        platformEmail
    };
}

/**
 * Reply to a ticket by email — sent directly through the agent's connected
 * mailbox (SMTP) so the message is delivered from the agent's real address
 * and filed in their Sent folder; IMAP Sent-sync is deduped by Message-ID.
 * Falls back to platform SMTP when no mailbox is connected.
 */
export async function replyToTicketByEmail(ticketId, data, actor) {
    const tenantId = actor?.tenantId || actor?.tenant_id || null;
    const ticket = await findTicketByPublicId(ticketId, {
        ...(tenantId ? { tenantId } : {})
    });

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    const toEmail = normalizeEmailAddress(data.toEmail || ticket.customerEmail);

    if (!toEmail) {
        throw new AppError("Ticket does not have a customer email address", 400);
    }

    const sender = await resolveOutboundSender(actor);
    const preferredFrom = formatFromAddress(sender.email, sender.name);

    const events = await listTicketEvents(ticket.id);
    const latestEmailEvent = [...events].reverse().find(
        (event) => event.type === "EMAIL" && event.metadata?.email?.messageId
    );
    const inReplyTo = data.inReplyTo || latestEmailEvent?.metadata?.email?.messageId || undefined;
    const references = data.references || latestEmailEvent?.metadata?.email?.references || inReplyTo;
    const subject = data.subject || `Re: [${ticket.ticketId}] ${ticket.title}`;
    const body = data.body.trim();

    const userId = actor?.userId || actor?.id;

    let emailAccount = null;
    if (userId) {
        try {
            emailAccount = await getDefaultEmailAccount(userId, tenantId);
        } catch {
            emailAccount = null;
        }
    }

    let outboundEmail = null;
    let effectiveFrom = preferredFrom;
    let usedMailbox = false;
    let sentFolder = null;

    if (emailAccount && emailAccount.isActive) {
        const smtpResult = await sendReplyEmail(emailAccount, toEmail, subject, body, {
            inReplyTo,
            references
        });
        outboundEmail = { id: smtpResult.messageId, messageId: smtpResult.messageId };
        effectiveFrom = formatFromAddress(emailAccount.email, emailAccount.displayName || sender.name);
        usedMailbox = true;
        sentFolder = smtpResult.sentFolder || null;
    } else {
        // No connected mailbox — deliver via platform SMTP.
        if (!isPlatformSmtpConfigured() && env.NODE_ENV === "production") {
            throw new AppError(
                "Connect your mailbox in Settings → Email so replies are sent from your own address (platform SMTP is not configured).",
                503
            );
        }
        const platformResult = await sendPlatformEmail({
            to: toEmail,
            from: preferredFrom,
            replyTo: sender.email,
            subject,
            text: body,
            html: data.html,
            headers: {
                ...(inReplyTo ? { "In-Reply-To": inReplyTo } : {}),
                ...(references ? { References: references } : {})
            }
        });
        outboundEmail = { id: platformResult.messageId, messageId: platformResult.messageId };
    }

    const event = await addEventToTicket(
        ticketId,
        {
            channel: TICKET_CHANNEL.EMAIL,
            email: {
                subject,
                body,
                fromEmail: effectiveFrom,
                toEmail,
                senderType: SENDER_TYPE.AGENT
            },
            eventMetadata: buildEmailMetadata({
                direction: "OUTBOUND",
                provider: emailAccount?.provider || "smtp",
                mailboxAccountId: emailAccount?.id || null,
                messageId: outboundEmail.messageId,
                inReplyTo,
                references
            })
        },
        actor
    );

    broadcastTicketEvent(ticketId, event, { source: "EMAIL", direction: "OUTBOUND" });

    return {
        email: outboundEmail,
        event,
        from: effectiveFrom,
        preferredFrom,
        fromFallback: !usedMailbox,
        senderSource: sender.source,
        usedMailbox,
        usedSmtp: usedMailbox,
        mailboxEmail: emailAccount?.email || null,
        emailAccountId: emailAccount?.id || null,
        sentFolder
    };
}

export { mapTicketResponse };
