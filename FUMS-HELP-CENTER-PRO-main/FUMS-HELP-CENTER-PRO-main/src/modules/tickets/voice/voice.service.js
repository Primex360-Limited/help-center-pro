import twilio from "twilio";
import { env } from "../../../config/env.js";
import prisma from "../../../database/prisma/client.js";
import { AppError } from "../../../shared/errors/AppError.js";
import {
    CALL_ACTOR,
    CALL_DIRECTION,
    CALL_EVENT_TYPE,
    TICKET_CHANNEL,
    TICKET_PRIORITY
} from "../ticket.constants.js";
import { createTicket } from "../ticket.service.js";
import { addEventToTicket, getTicketThread } from "../timeline/timeline.service.js";
import { findTicketByPublicId } from "../ticket.repository.js";
import { mapTicketEventResponse } from "../helpers/map-ticket-event-response.js";
import {
    createVoiceAccessToken,
    getTwilioClient,
    getTwilioPhoneNumber,
    isBrowserVoiceConfigured,
    isTwilioConfigured
} from "./twilio.client.js";
import { isLikelyMobileE164, toE164 } from "./phone.utils.js";

function publicApiBase() {
    return (env.PUBLIC_API_URL || `http://localhost:${env.PORT}`).replace(/\/$/, "");
}

function agentActor(actor) {
    return {
        userId: actor.userId,
        name: actor.name,
        email: actor.email,
        tenantId: actor.tenantId || null
    };
}

/**
 * HelpCentre Pro line for this tenant (settings callNumbers) or platform Twilio number.
 */
async function resolveTenantFromNumber(actor) {
    if (actor?.tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: actor.tenantId },
            select: { settings: true }
        });
        const settings =
            tenant?.settings && typeof tenant.settings === "object"
                ? tenant.settings
                : {};
        const calling =
            settings.calling && typeof settings.calling === "object"
                ? settings.calling
                : {};

        // Tenant's existing number wins when selected (HCP line paused).
        if (calling.mode === "own" && calling.ownNumber) {
            const own = toE164(String(calling.ownNumber));
            if (own) return own;
        }

        const numbers = Array.isArray(settings.callNumbers)
            ? settings.callNumbers
            : [];
        // Skip fictional demo placeholders (e.g. +1 555-01xx) — Twilio rejects them.
        const usable = numbers.filter(
            (n) =>
                n?.e164 &&
                n?.status !== "inactive" &&
                !/^\+155501\d{2}$/.test(String(n.e164).replace(/[\s()-]/g, ""))
        );

        if (!calling.hcpPaused) {
            const fromWorkspace = toE164(String(usable[0]?.e164 || ""));
            if (fromWorkspace) return fromWorkspace;
        } else if (calling.ownNumber) {
            const own = toE164(String(calling.ownNumber));
            if (own) return own;
        }
    }

    return toE164(getTwilioPhoneNumber() || "") || getTwilioPhoneNumber();
}

/**
 * Optional silent agent bridge (profile / env only — never collected in the UI).
 */
async function resolveAgentPhone(actor) {
    if (actor?.userId) {
        const user = await prisma.user.findUnique({
            where: { id: actor.userId },
            select: { phoneNumber: true, metadata: true }
        });
        const fromProfile = toE164(user?.phoneNumber || "");
        if (fromProfile) return fromProfile;

        const metaPhone =
            user?.metadata && typeof user.metadata === "object"
                ? user.metadata.agentPhone || user.metadata.phone
                : null;
        const fromMeta = toE164(String(metaPhone || ""));
        if (fromMeta) return fromMeta;
    }

    return toE164(env.TWILIO_AGENT_FALLBACK_NUMBER || "") || null;
}

/**
 * Place a real PSTN outbound call from the HelpCentre Pro / Twilio line
 * to any customer number (MTN, Airtel, Glo, 9mobile, international).
 *
 * Uses the provisioned workspace number as caller ID — agents do not enter it.
 */
export async function placeOutboundCall({
    to,
    ticketId = null,
    customerName = null,
    customerEmail = null,
    title = null,
    defaultRegion = "NG",
    actor
}) {
    if (!isTwilioConfigured()) {
        throw new AppError(
            "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to place real phone calls.",
            503
        );
    }

    const customerNumber = toE164(to, { defaultRegion });
    if (!customerNumber || !isLikelyMobileE164(customerNumber)) {
        throw new AppError(
            "Enter a valid customer phone number (e.g. +2348031234567 or 08031234567).",
            400
        );
    }

    const fromNumber = await resolveTenantFromNumber(actor);
    if (!fromNumber) {
        throw new AppError(
            "No HelpCentre Pro call number is provisioned for this workspace yet.",
            503
        );
    }

    if (fromNumber === customerNumber) {
        throw new AppError("Customer number cannot match your support line", 400);
    }

    let ticket = ticketId ? await findTicketByPublicId(ticketId) : null;

    if (!ticket) {
        ticket = await createTicket(
            {
                title: title || `Outbound call to ${customerName || customerNumber}`,
                description: `Outbound PSTN call to ${customerNumber} from ${fromNumber}.`,
                priority: TICKET_PRIORITY.MEDIUM,
                channel: TICKET_CHANNEL.PHONE,
                customerName: customerName || customerNumber,
                customerEmail: customerEmail || undefined,
                customerPhone: customerNumber,
                call: {
                    direction: CALL_DIRECTION.OUTBOUND,
                    duration: 0
                }
            },
            agentActor(actor)
        );
    } else if (!ticket.customerPhone) {
        await prisma.ticket.update({
            where: { id: ticket.id },
            data: { customerPhone: customerNumber }
        });
    }

    const statusCallback = `${publicApiBase()}/api/v1/tickets/voice/webhooks/status`;
    const agentNumber = await resolveAgentPhone(actor);

    // 1) Agent handset on profile → ring agent first, then dial customer (any carrier).
    if (agentNumber && agentNumber !== customerNumber) {
        const connectUrl =
            `${publicApiBase()}/api/v1/tickets/voice/twiml/connect-customer` +
            `?to=${encodeURIComponent(customerNumber)}` +
            `&ticketId=${encodeURIComponent(ticket.ticketId)}` +
            `&from=${encodeURIComponent(fromNumber)}`;

        const call = await getTwilioClient().calls.create({
            to: agentNumber,
            from: fromNumber,
            url: connectUrl,
            method: "POST",
            statusCallback,
            statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
            statusCallbackMethod: "POST"
        });

        await addEventToTicket(
            ticket.ticketId,
            {
                channel: TICKET_CHANNEL.PHONE,
                customerName: customerName || ticket.customerName,
                customerEmail: customerEmail || ticket.customerEmail,
                customerPhone: customerNumber,
                call: {
                    direction: CALL_DIRECTION.OUTBOUND,
                    duration: 0
                },
                eventMetadata: {
                    provider: "twilio",
                    callMode: "pstn_bridge",
                    callSid: call.sid,
                    callStatus: call.status,
                    from: fromNumber,
                    agentPhone: agentNumber,
                    to: customerNumber,
                    direction: CALL_DIRECTION.OUTBOUND,
                    note: "Agent handset rings first; customer dialed on answer."
                }
            },
            agentActor(actor)
        );

        return {
            ticketId: ticket.ticketId,
            callSid: call.sid,
            status: call.status,
            mode: "pstn_bridge",
            from: fromNumber,
            agentPhone: agentNumber,
            to: customerNumber,
            message:
                "Your phone will ring first — answer to talk to the customer."
        };
    }

    // 2) No agent number → agent talks from the browser via the HCP Twilio line.
    //    The PSTN leg is created by the Voice SDK when the agent connects;
    //    TwiML (browser-outbound) dials the customer with the HCP caller ID.
    if (!isBrowserVoiceConfigured()) {
        throw new AppError(
            "Add your agent phone number in your profile to call from your handset, or configure browser voice (TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID) to call from this device.",
            503
        );
    }

    await addEventToTicket(
        ticket.ticketId,
        {
            channel: TICKET_CHANNEL.PHONE,
            customerName: customerName || ticket.customerName,
            customerEmail: customerEmail || ticket.customerEmail,
            customerPhone: customerNumber,
            call: {
                direction: CALL_DIRECTION.OUTBOUND,
                duration: 0
            },
            eventMetadata: {
                provider: "twilio",
                callMode: "browser_pstn",
                callSid: null,
                callStatus: "initiated_browser",
                from: fromNumber,
                agentPhone: null,
                to: customerNumber,
                direction: CALL_DIRECTION.OUTBOUND,
                note: "Browser voice via HelpCentre Pro line (no agent handset)."
            }
        },
        agentActor(actor)
    );

    return {
        ticketId: ticket.ticketId,
        callSid: null,
        status: "initiated_browser",
        mode: "browser_pstn",
        from: fromNumber,
        to: customerNumber,
        message: "Connecting you from this device via your HelpCentre Pro line…"
    };
}

/**
 * TwiML for browser softphone calls — dials the customer PSTN number
 * with the workspace HelpCentre Pro line as caller ID. Recorded both ways.
 * Invoked via the TwiML App Voice URL when the agent connects from the browser.
 */
export function buildBrowserOutboundTwiml({ to, ticketId, from }) {
    const customerNumber = toE164(to, { defaultRegion: "NG" });
    const response = new twilio.twiml.VoiceResponse();

    if (!customerNumber) {
        response.say(
            { voice: "alice" },
            "Sorry, that number is invalid. Goodbye."
        );
        response.hangup();
        return response.toString();
    }

    const callerId = toE164(from || "") || getTwilioPhoneNumber();
    const recordingCallback = `${publicApiBase()}/api/v1/tickets/voice/webhooks/recording`;
    const statusCallback =
        `${publicApiBase()}/api/v1/tickets/voice/webhooks/status` +
        (ticketId ? `?ticketId=${encodeURIComponent(ticketId)}` : "");
    const recordingCallbackWithTicket =
        recordingCallback +
        (ticketId ? `?ticketId=${encodeURIComponent(ticketId)}` : "");

    const dial = response.dial({
        callerId,
        record: "record-from-answer-dual",
        recordingStatusCallback: recordingCallbackWithTicket,
        recordingStatusCallbackMethod: "POST",
        timeout: 60,
        answerOnBridge: true
    });

    dial.number(
        {
            statusCallback,
            statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
            statusCallbackMethod: "POST"
        },
        customerNumber
    );

    return response.toString();
}

/**
 * TwiML when agent answers — dials the customer on the PSTN.
 */
export function buildConnectCustomerTwiml({ to, ticketId, from }) {
    const customerNumber = toE164(to, { defaultRegion: "NG" });
    const response = new twilio.twiml.VoiceResponse();

    if (!customerNumber) {
        response.say(
            { voice: "alice" },
            "Sorry, the customer number is invalid. Goodbye."
        );
        response.hangup();
        return response.toString();
    }

    const fromNumber = toE164(from || "") || getTwilioPhoneNumber();
    const recordingCallback = `${publicApiBase()}/api/v1/tickets/voice/webhooks/recording`;

    response.say(
        { voice: "alice" },
        "Connecting you to the customer. This call may be recorded for quality."
    );

    const dial = response.dial({
        callerId: fromNumber,
        record: "record-from-answer-dual",
        recordingStatusCallback: recordingCallback,
        recordingStatusCallbackMethod: "POST",
        timeout: 45,
        answerOnBridge: true
    });

    dial.number(
        {
            statusCallback: `${publicApiBase()}/api/v1/tickets/voice/webhooks/status`,
            statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
            statusCallbackMethod: "POST"
        },
        customerNumber
    );

    if (ticketId) {
        response.pause({ length: 0 });
    }

    return response.toString();
}

/**
 * TwiML when the customer answers a direct outbound call from the HCP line.
 */
export function buildOutboundCustomerTwiml({ ticketId } = {}) {
    const response = new twilio.twiml.VoiceResponse();
    response.say(
        { voice: "alice" },
        "Hello, this is a call from support. Please stay on the line."
    );
    // Keep the line open so the conversation can continue / be recorded.
    response.pause({ length: 600 });
    if (ticketId) {
        response.pause({ length: 0 });
    }
    return response.toString();
}

/** @deprecated Prefer buildConnectCustomerTwiml / buildOutboundCustomerTwiml. */
export function buildOutboundTwiml() {
    return buildOutboundCustomerTwiml({});
}

/**
 * Stream a Twilio recording through the API (authenticated download / playback).
 */
export async function streamTicketRecording(ticketId, res) {
    const ticket = await findTicketByPublicId(ticketId);
    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    const events = await prisma.ticketEvent.findMany({
        where: {
            ticketRefId: ticket.id,
            channel: TICKET_CHANNEL.PHONE
        },
        include: { call: true },
        orderBy: { createdAt: "desc" },
        take: 20
    });

    let recordingUrl = null;
    for (const event of events) {
        const fromCall = event?.call?.recordingUrl;
        const fromMeta =
            event?.metadata && typeof event.metadata === "object"
                ? event.metadata.recordingUrl
                : null;
        if (fromCall || fromMeta) {
            recordingUrl = fromCall || fromMeta;
            break;
        }
    }

    if (!recordingUrl) {
        throw new AppError("No recording available for this ticket", 404);
    }

    if (!isTwilioConfigured()) {
        throw new AppError("Twilio is not configured", 503);
    }

    const mediaUrl = String(recordingUrl).endsWith(".mp3")
        ? String(recordingUrl)
        : `${recordingUrl}.mp3`;

    const auth = Buffer.from(
        `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`
    ).toString("base64");

    const upstream = await fetch(mediaUrl, {
        headers: { Authorization: `Basic ${auth}` }
    });

    if (!upstream.ok) {
        throw new AppError("Unable to fetch recording from Twilio", 502);
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${ticket.ticketId}-recording.mp3"`
    );
    res.setHeader("Cache-Control", "private, max-age=300");

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
    return { streamed: true, ticketId: ticket.ticketId };
}

export async function getAgentVoiceToken(actor) {
    const identity = `agent_${actor.userId || "user"}`;
    const token = createVoiceAccessToken({ identity });
    const fromNumber = await resolveTenantFromNumber(actor);
    return {
        identity,
        token,
        configured: isTwilioConfigured(),
        browserConfigured: isBrowserVoiceConfigured(),
        pstnEnabled: isTwilioConfigured(),
        from: fromNumber,
        twimlAppVoiceUrl: `${publicApiBase()}/api/v1/tickets/voice/twiml/browser-outbound`
    };
}

async function findCallEventForWebhook({ callSid, parentCallSid, ticketId }) {
    const event = await prisma.ticketEvent.findFirst({
        where: {
            channel: TICKET_CHANNEL.PHONE,
            OR: [
                { metadata: { path: ["callSid"], equals: callSid } },
                {
                    metadata: {
                        path: ["callSid"],
                        equals: parentCallSid || ""
                    }
                }
            ]
        },
        include: {
            call: true,
            ticket: true
        }
    });
    if (event) return event;

    // Browser calls: match by ticketId carried on the callback URL.
    if (ticketId) {
        const ticket = await findTicketByPublicId(ticketId);
        if (ticket) {
            return prisma.ticketEvent.findFirst({
                where: {
                    ticketRefId: ticket.id,
                    channel: TICKET_CHANNEL.PHONE
                },
                include: {
                    call: true,
                    ticket: true
                },
                orderBy: { createdAt: "desc" }
            });
        }
    }

    return null;
}

export async function handleTwilioStatusWebhook(body = {}) {
    const callSid = body.CallSid || body.ParentCallSid;
    if (!callSid) {
        return { ignored: true };
    }

    const duration = body.CallDuration ? Number(body.CallDuration) : null;
    const status = body.CallStatus || null;

    const event = await findCallEventForWebhook({
        callSid,
        parentCallSid: body.ParentCallSid,
        ticketId: body.ticketId
    });

    if (!event) {
        return { matched: false, callSid, status };
    }

    const metadata = {
        ...(event.metadata && typeof event.metadata === "object" ? event.metadata : {}),
        callSid: event.metadata?.callSid || callSid,
        lastChildCallSid: body.CallSid,
        callStatus: status,
        provider: "twilio",
        from: body.From || event.metadata?.from,
        to: body.To || event.metadata?.to
    };

    await prisma.ticketEvent.update({
        where: { id: event.id },
        data: { metadata }
    });

    if (event.call?.id && duration != null && !Number.isNaN(duration)) {
        await prisma.ticketCall.update({
            where: { id: event.call.id },
            data: { duration }
        });

        await prisma.ticketCallLog.create({
            data: {
                callId: event.call.id,
                eventType:
                    status === "completed"
                        ? CALL_EVENT_TYPE.CALL_HANGUP
                        : status === "in-progress" || status === "answered"
                          ? CALL_EVENT_TYPE.CALL_PICKED
                          : CALL_EVENT_TYPE.CALL_RECEIVED,
                actor: CALL_ACTOR.SYSTEM,
                direction: CALL_DIRECTION.OUTBOUND
            }
        });
    }

    return {
        matched: true,
        ticketId: event.ticket?.ticketId,
        callSid,
        status,
        duration
    };
}

export async function handleTwilioRecordingWebhook(body = {}) {
    const callSid = body.CallSid || body.ParentCallSid;
    const recordingUrl = body.RecordingUrl ? `${body.RecordingUrl}.mp3` : null;
    const recordingSid = body.RecordingSid || null;
    const duration = body.RecordingDuration
        ? Number(body.RecordingDuration)
        : null;

    if (!callSid || !recordingUrl) {
        return { ignored: true };
    }

    const event = await findCallEventForWebhook({
        callSid,
        parentCallSid: body.ParentCallSid,
        ticketId: body.ticketId
    });

    if (!event?.call?.id) {
        return { matched: false, callSid };
    }

    const metadata = {
        ...(event.metadata && typeof event.metadata === "object" ? event.metadata : {}),
        callSid: event.metadata?.callSid || callSid,
        recordingSid,
        recordingUrl,
        callStatus: "completed",
        provider: "twilio",
        callMode: event.metadata?.callMode || "pstn_bridge"
    };

    await prisma.ticketEvent.update({
        where: { id: event.id },
        data: { metadata }
    });

    await prisma.ticketCall.update({
        where: { id: event.call.id },
        data: {
            recordingUrl,
            ...(duration != null && !Number.isNaN(duration) ? { duration } : {})
        }
    });

    const thread = await getTicketThread(event.ticket.ticketId);

    return {
        matched: true,
        ticketId: event.ticket.ticketId,
        recordingUrl,
        event:
            thread.find((row) => row.id === event.id) ||
            mapTicketEventResponse(event)
    };
}

export default {
    placeOutboundCall,
    buildConnectCustomerTwiml,
    buildBrowserOutboundTwiml,
    buildOutboundCustomerTwiml,
    buildOutboundTwiml,
    getAgentVoiceToken,
    handleTwilioStatusWebhook,
    handleTwilioRecordingWebhook,
    streamTicketRecording
};
