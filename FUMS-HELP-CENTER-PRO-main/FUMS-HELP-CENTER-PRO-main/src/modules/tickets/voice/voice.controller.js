import successResponse from "../../../shared/utils/apiResponse.js";
import { buildActorSnapshotFromRequest } from "../ticket.utils.js";
import {
    buildConnectCustomerTwiml,
    buildOutboundCustomerTwiml,
    getAgentVoiceToken,
    handleTwilioRecordingWebhook,
    handleTwilioStatusWebhook,
    placeOutboundCall,
    streamTicketRecording
} from "./voice.service.js";

export async function placeOutboundCallHandler(req, res) {
    const body = req.validatedBody || req.body || {};
    const result = await placeOutboundCall({
        ...body,
        actor: buildActorSnapshotFromRequest(req)
    });

    return successResponse(res, result.message || "Outbound call started", result, 201);
}

export async function getVoiceTokenHandler(req, res) {
    const result = getAgentVoiceToken(buildActorSnapshotFromRequest(req));
    return successResponse(res, "Twilio voice token", result);
}

export async function connectCustomerTwimlHandler(req, res) {
    const to = req.query.to || req.body?.to || "";
    const ticketId = req.query.ticketId || req.body?.ticketId || "";
    res.type("text/xml").send(buildConnectCustomerTwiml({ to, ticketId }));
}

export async function outboundCustomerTwimlHandler(req, res) {
    const ticketId = req.query.ticketId || req.body?.ticketId || "";
    res.type("text/xml").send(buildOutboundCustomerTwiml({ ticketId }));
}

export async function downloadRecordingHandler(req, res) {
    const ticketId = req.params.ticketId || req.query.ticketId;
    await streamTicketRecording(ticketId, res);
}

export async function twilioStatusWebhookHandler(req, res) {
    const result = await handleTwilioStatusWebhook(req.body || {});
    return successResponse(res, "Twilio status received", result);
}

export async function twilioRecordingWebhookHandler(req, res) {
    const result = await handleTwilioRecordingWebhook(req.body || {});
    return successResponse(res, "Twilio recording received", result);
}
