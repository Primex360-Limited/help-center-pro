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
import { isLikelyMobileE164, toE164 } from "./phone.utils.js";
import {
    contentTypeForPath,
    isLocalRecordingRef,
    resolveLocalRecording,
    saveCallRecordingDataUrl
} from "./recording.storage.js";
import fs from "fs/promises";

async function loadActiveVoipConfig(tenantId) {
    if (!tenantId) return null;
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true }
    });
    const settings =
        tenant?.settings && typeof tenant.settings === "object"
            ? tenant.settings
            : {};
    const configurations = Array.isArray(settings.voipConfigurations)
        ? settings.voipConfigurations
        : [];
    const activeConfigId = settings.voipActiveConfigId || "";
    if (!activeConfigId) return null;
    const active = configurations.find((c) => c.id === activeConfigId);
    if (!active || active.enabled === false) return null;
    return active;
}

function extractSipCallerId(credentials = {}) {
    return (
        toE164(
            String(
                credentials.sipCallerId ||
                    credentials.callerId ||
                    credentials.fromNumber ||
                    credentials.phoneNumber ||
                    ""
            )
        ) || null
    );
}

function assertSipCredentials(credentials = {}) {
    const host =
        credentials.sipServer ||
        credentials.sipDomain ||
        credentials.sipHost ||
        credentials.sipRealm ||
        credentials.sipRegistrar ||
        credentials.sipEndpoint ||
        credentials.sipProxy ||
        credentials.sipGateway ||
        credentials.sipTrunk;
    const user =
        credentials.sipUsername ||
        credentials.sipUser ||
        credentials.sipAuthUser ||
        credentials.sipExtension ||
        credentials.sipAuth;
    const password =
        credentials.sipPassword ||
        credentials.sipPass ||
        credentials.sipSecret ||
        credentials.sipAuthPass;
    if (!host || !user || !password) {
        throw new AppError(
            "Your active VoIP/SIP provider is missing server, username, or password. Update it in Settings → VoIP/SIP.",
            400
        );
    }
    return { host, user, password };
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
 * Resolve outbound caller ID from workspace calling settings or SIP config.
 */
async function resolveTenantFromNumber(actor, voipCredentials = null) {
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

        if (calling.mode === "own" && calling.ownNumber) {
            const own = toE164(String(calling.ownNumber));
            if (own) return own;
        }

        const numbers = Array.isArray(settings.callNumbers)
            ? settings.callNumbers
            : [];
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

    return extractSipCallerId(voipCredentials || {});
}

/**
 * Place an outbound call via the tenant's active VoIP/SIP provider (browser softphone).
 * No paid CPaaS — tenants bring their own SIP credentials.
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
    const customerNumber = toE164(to, { defaultRegion });
    if (!customerNumber || !isLikelyMobileE164(customerNumber)) {
        throw new AppError(
            "Enter a valid customer phone number (e.g. +2348031234567 or 08031234567).",
            400
        );
    }

    const tenantId = actor?.tenantId || null;
    const activeVoip = await loadActiveVoipConfig(tenantId);
    if (!activeVoip) {
        throw new AppError(
            "No VoIP/SIP provider is active. Add a SIP provider in Settings → VoIP/SIP and set it as active.",
            503
        );
    }

    assertSipCredentials(activeVoip.credentials || {});
    const voipProvider = activeVoip.providerId;
    const voipCredentials = activeVoip.credentials || {};
    const fromNumber =
        (await resolveTenantFromNumber(actor, voipCredentials)) ||
        extractSipCallerId(voipCredentials);

    if (fromNumber && fromNumber === customerNumber) {
        throw new AppError("Customer number cannot match your support line", 400);
    }

    let ticket = ticketId
        ? await findTicketByPublicId(ticketId, {
              ...(tenantId ? { tenantId } : {})
          })
        : null;

    if (!ticket) {
        ticket = await createTicket(
            {
                title: title || `Outbound call to ${customerName || customerNumber}`,
                description: `Outbound call to ${customerNumber}${fromNumber ? ` from ${fromNumber}` : ""} via ${voipProvider}.`,
                priority: TICKET_PRIORITY.MEDIUM,
                tenantId,
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

    const callSid = `sip_out_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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
                provider: voipProvider,
                callMode: "browser_sip",
                callSid,
                callStatus: "initiated",
                from: fromNumber,
                to: customerNumber,
                direction: CALL_DIRECTION.OUTBOUND,
                note: "Browser softphone via tenant VoIP/SIP provider."
            }
        },
        agentActor(actor)
    );

    return {
        ticketId: ticket.ticketId,
        callSid,
        status: "initiated",
        mode: "browser_sip",
        provider: voipProvider,
        from: fromNumber,
        to: customerNumber,
        message: "Connecting from this device via your configured VoIP/SIP provider…"
    };
}

/**
 * Create/update an inbound call ticket when the softphone answers a SIP INVITE.
 */
export async function startInboundSipCall({
    from,
    to = null,
    ticketId = null,
    customerName = null,
    customerEmail = null,
    title = null,
    defaultRegion = "NG",
    callSid = null,
    actor
}) {
    const tenantId = actor?.tenantId || null;
    const activeVoip = await loadActiveVoipConfig(tenantId);
    if (!activeVoip) {
        throw new AppError(
            "No VoIP/SIP provider is active. Configure one in Settings → VoIP/SIP.",
            503
        );
    }
    assertSipCredentials(activeVoip.credentials || {});

    const callerNumber =
        toE164(from, { defaultRegion }) || String(from || "").trim();
    if (!callerNumber) {
        throw new AppError("Caller number is required for inbound calls.", 400);
    }

    const voipProvider = activeVoip.providerId;
    const fromNumber =
        to ||
        (await resolveTenantFromNumber(actor, activeVoip.credentials || {})) ||
        extractSipCallerId(activeVoip.credentials || {});
    const sid =
        callSid ||
        `sip_in_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    let ticket = ticketId
        ? await findTicketByPublicId(ticketId, {
              ...(tenantId ? { tenantId } : {})
          })
        : null;

    if (!ticket) {
        ticket = await createTicket(
            {
                title: title || `Inbound call from ${customerName || callerNumber}`,
                description: `Inbound call from ${callerNumber}${fromNumber ? ` to ${fromNumber}` : ""}.`,
                priority: TICKET_PRIORITY.MEDIUM,
                tenantId,
                channel: TICKET_CHANNEL.PHONE,
                customerName: customerName || callerNumber,
                customerEmail: customerEmail || undefined,
                customerPhone: callerNumber,
                call: {
                    direction: CALL_DIRECTION.INBOUND,
                    duration: 0
                }
            },
            agentActor(actor)
        );
    }

    await addEventToTicket(
        ticket.ticketId,
        {
            channel: TICKET_CHANNEL.PHONE,
            customerName: customerName || ticket.customerName,
            customerEmail: customerEmail || ticket.customerEmail,
            customerPhone: callerNumber,
            call: {
                direction: CALL_DIRECTION.INBOUND,
                duration: 0
            },
            eventMetadata: {
                provider: voipProvider,
                callMode: "browser_sip",
                callSid: sid,
                callStatus: "in-progress",
                from: callerNumber,
                to: fromNumber,
                direction: CALL_DIRECTION.INBOUND,
                note: "Inbound call answered on browser softphone."
            }
        },
        agentActor(actor)
    );

    return {
        ticketId: ticket.ticketId,
        callSid: sid,
        status: "in-progress",
        mode: "browser_sip",
        provider: voipProvider,
        from: callerNumber,
        to: fromNumber,
        message: "Inbound call ticket created."
    };
}

/**
 * Finalize a SIP call on the ticket (duration, status, recording, transcript, quality).
 */
export async function completeSipCall({
    ticketId,
    callSid = null,
    durationSeconds = 0,
    status = "completed",
    recordingUrl = null,
    recordingDataUrl = null,
    transcript = null,
    quality = null,
    summary = null,
    actor
}) {
    if (!ticketId) {
        throw new AppError("ticketId is required", 400);
    }

    const tenantId = actor?.tenantId || null;
    const ticket = await findTicketByPublicId(ticketId, {
        ...(tenantId ? { tenantId } : {})
    });
    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    const duration = Math.max(0, Math.floor(Number(durationSeconds) || 0));
    const normalizedStatus = String(status || "completed").toLowerCase();

    const event = await prisma.ticketEvent.findFirst({
        where: {
            ticketRefId: ticket.id,
            channel: TICKET_CHANNEL.PHONE,
            ...(callSid
                ? { metadata: { path: ["callSid"], equals: callSid } }
                : {})
        },
        include: { call: true, ticket: true },
        orderBy: { createdAt: "desc" }
    });

    if (!event) {
        throw new AppError("Call event not found for this ticket", 404);
    }

    let storedRecordingUrl = recordingUrl || null;
    if (recordingDataUrl) {
        const saved = await saveCallRecordingDataUrl({
            tenantId: tenantId || ticket.tenantId || "platform",
            ticketId: ticket.ticketId,
            callSid: callSid || event.metadata?.callSid,
            dataUrl: recordingDataUrl
        });
        storedRecordingUrl = saved.ref;
    }

    const existingMeta =
        event.metadata && typeof event.metadata === "object" ? event.metadata : {};
    const nextTranscript = Array.isArray(transcript)
        ? transcript
        : Array.isArray(existingMeta.transcript)
          ? existingMeta.transcript
          : [];

    if (summary && String(summary).trim()) {
        nextTranscript.push({
            speaker: "Agent",
            role: "summary",
            text: String(summary).trim(),
            time: formatDurationLabel(duration)
        });
    }

    const metadata = {
        ...existingMeta,
        callSid: callSid || existingMeta.callSid || null,
        callStatus: normalizedStatus,
        completedAt: new Date().toISOString(),
        ...(storedRecordingUrl ? { recordingUrl: storedRecordingUrl } : {}),
        transcript: nextTranscript,
        ...(quality && typeof quality === "object" ? { quality } : {})
    };

    await prisma.ticketEvent.update({
        where: { id: event.id },
        data: { metadata }
    });

    if (event.call?.id) {
        await prisma.ticketCall.update({
            where: { id: event.call.id },
            data: {
                duration,
                ...(storedRecordingUrl ? { recordingUrl: storedRecordingUrl } : {})
            }
        });

        await prisma.ticketCallLog.create({
            data: {
                callId: event.call.id,
                eventType:
                    normalizedStatus === "completed" ||
                    normalizedStatus === "ended"
                        ? CALL_EVENT_TYPE.CALL_HANGUP
                        : CALL_EVENT_TYPE.CALL_PICKED,
                actor: CALL_ACTOR.AGENT,
                direction:
                    event.call.direction === CALL_DIRECTION.INBOUND
                        ? CALL_DIRECTION.INBOUND
                        : CALL_DIRECTION.OUTBOUND
            }
        });
    }

    const thread = await getTicketThread(ticket.ticketId);
    return {
        ticketId: ticket.ticketId,
        callSid: metadata.callSid,
        status: normalizedStatus,
        duration,
        recordingUrl: storedRecordingUrl,
        hasTranscript: nextTranscript.length > 0,
        event:
            thread.find((row) => row.id === event.id) ||
            mapTicketEventResponse(event)
    };
}

function formatDurationLabel(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Softphone readiness for the agent (SIP registration happens in the browser).
 */
export async function getAgentVoiceToken(actor) {
    const identity = `agent_${actor.userId || "user"}`;
    const activeVoip = await loadActiveVoipConfig(actor?.tenantId || null);
    let sipReady = false;
    if (activeVoip) {
        try {
            assertSipCredentials(activeVoip.credentials || {});
            sipReady = true;
        } catch {
            sipReady = false;
        }
    }

    const fromNumber = activeVoip
        ? await resolveTenantFromNumber(actor, activeVoip.credentials || {})
        : null;

    return {
        identity,
        token: null,
        configured: sipReady,
        browserConfigured: sipReady,
        pstnEnabled: false,
        mode: "browser_sip",
        provider: activeVoip?.providerId || null,
        providerName: activeVoip?.name || activeVoip?.providerId || null,
        from: fromNumber,
        message: sipReady
            ? "VoIP/SIP softphone ready. Calls use your active provider."
            : "Configure and activate a VoIP/SIP provider in Settings → VoIP/SIP."
    };
}

/**
 * Stream a call recording (local softphone upload or remote HTTPS URL).
 */
export async function streamTicketRecording(ticketId, res, tenantId = null) {
    const ticket = await findTicketByPublicId(ticketId, {
        ...(tenantId ? { tenantId } : {})
    });
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

    const url = String(recordingUrl);

    if (isLocalRecordingRef(url)) {
        const absolute = await resolveLocalRecording(url);
        const buffer = await fs.readFile(absolute);
        const contentType = contentTypeForPath(absolute);
        const ext = contentType.split("/")[1] || "webm";
        res.setHeader("Content-Type", contentType);
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${ticket.ticketId}-recording.${ext}"`
        );
        res.setHeader("Cache-Control", "private, max-age=300");
        res.send(buffer);
        return { streamed: true, ticketId: ticket.ticketId, source: "local" };
    }

    if (!/^https?:\/\//i.test(url)) {
        throw new AppError("Recording URL is not fetchable", 400);
    }

    const upstream = await fetch(url);
    if (!upstream.ok) {
        throw new AppError("Unable to fetch recording", 502);
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader(
        "Content-Disposition",
        `inline; filename="${ticket.ticketId}-recording.mp3"`
    );
    res.setHeader("Cache-Control", "private, max-age=300");

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
    return { streamed: true, ticketId: ticket.ticketId, source: "remote" };
}

export default {
    placeOutboundCall,
    startInboundSipCall,
    completeSipCall,
    getAgentVoiceToken,
    streamTicketRecording
};
