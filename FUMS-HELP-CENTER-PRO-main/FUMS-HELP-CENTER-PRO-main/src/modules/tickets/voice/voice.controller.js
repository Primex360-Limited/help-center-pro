import successResponse from "../../../shared/utils/apiResponse.js";
import { buildActorSnapshotFromRequest } from "../ticket.utils.js";
import {
    buildBrowserOutboundTwiml,
    buildConnectCustomerTwiml,
    buildOutboundCustomerTwiml,
    getAgentVoiceToken,
    handleTwilioRecordingWebhook,
    handleTwilioStatusWebhook,
    placeOutboundCall,
    streamTicketRecording
} from "./voice.service.js";

function pickParam(req, ...names) {
    for (const name of names) {
        const value =
            req.body?.[name] ?? req.query?.[name] ?? undefined;
        if (value !== undefined && value !== null && value !== "") {
            return String(value);
        }
    }
    return "";
}

export async function placeOutboundCallHandler(req, res) {
    const body = req.validatedBody || req.body || {};
    const result = await placeOutboundCall({
        ...body,
        actor: buildActorSnapshotFromRequest(req)
    });

    return successResponse(res, result.message || "Outbound call started", result, 201);
}

export async function getVoiceTokenHandler(req, res) {
    const result = await getAgentVoiceToken(buildActorSnapshotFromRequest(req));
    return successResponse(res, "Twilio voice token", result);
}

export async function connectCustomerTwimlHandler(req, res) {
    const to = pickParam(req, "to", "To");
    const ticketId = pickParam(req, "ticketId", "TicketId");
    const from = pickParam(req, "from", "From");
    res.type("text/xml").send(buildConnectCustomerTwiml({ to, ticketId, from }));
}

export async function browserOutboundTwimlHandler(req, res) {
    const to = pickParam(req, "To", "to");
    const ticketId = pickParam(req, "ticketId", "TicketId");
    const from = pickParam(req, "from", "From", "callerId", "CallerId");
    res.type("text/xml").send(buildBrowserOutboundTwiml({ to, ticketId, from }));
}

export async function outboundCustomerTwimlHandler(req, res) {
    const ticketId = pickParam(req, "ticketId", "TicketId");
    res.type("text/xml").send(buildOutboundCustomerTwiml({ ticketId }));
}

export async function downloadRecordingHandler(req, res) {
    const ticketId = req.params.ticketId || req.query.ticketId;
    await streamTicketRecording(ticketId, res);
}

export async function twilioStatusWebhookHandler(req, res) {
    const result = await handleTwilioStatusWebhook({
        ...(req.query || {}),
        ...(req.body || {})
    });
    return successResponse(res, "Twilio status received", result);
}

export async function twilioRecordingWebhookHandler(req, res) {
    const result = await handleTwilioRecordingWebhook({
        ...(req.query || {}),
        ...(req.body || {})
    });
    return successResponse(res, "Twilio recording received", result);
}
