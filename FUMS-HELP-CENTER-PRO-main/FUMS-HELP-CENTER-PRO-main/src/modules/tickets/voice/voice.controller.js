import successResponse from "../../../shared/utils/apiResponse.js";
import { buildActorSnapshotFromRequest } from "../ticket.utils.js";
import {
    completeSipCall,
    getAgentVoiceToken,
    placeOutboundCall,
    startInboundSipCall,
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

export async function startInboundSipCallHandler(req, res) {
    const body = req.validatedBody || req.body || {};
    const result = await startInboundSipCall({
        ...body,
        actor: buildActorSnapshotFromRequest(req)
    });
    return successResponse(res, result.message || "Inbound call started", result, 201);
}

export async function completeSipCallHandler(req, res) {
    const body = req.validatedBody || req.body || {};
    const result = await completeSipCall({
        ...body,
        actor: buildActorSnapshotFromRequest(req)
    });
    return successResponse(res, "Call completed", result);
}

export async function getVoiceTokenHandler(req, res) {
    const result = await getAgentVoiceToken(buildActorSnapshotFromRequest(req));
    return successResponse(res, "VoIP softphone status", result);
}

export async function downloadRecordingHandler(req, res) {
    const ticketId = req.params.ticketId || req.query.ticketId;
    const tenantId = req.user?.tenantId || req.tenantId || null;
    await streamTicketRecording(ticketId, res, tenantId);
}
