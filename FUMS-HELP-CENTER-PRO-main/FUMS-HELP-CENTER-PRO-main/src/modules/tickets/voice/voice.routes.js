import express from "express";
import asyncHandler from "../../../middleware/async.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { bindTenantToUser } from "../../tenants/tenant.middleware.js";
import { requirePermission } from "../../roles/rbac.middleware.js";
import { TICKET_PERMISSIONS } from "../ticket.constants.js";
import {
    completeSipCallHandler,
    downloadRecordingHandler,
    getVoiceTokenHandler,
    placeOutboundCallHandler,
    startInboundSipCallHandler
} from "./voice.controller.js";
import {
    completeSipCallSchema,
    placeOutboundCallSchema,
    startInboundSipCallSchema
} from "./voice.validation.js";

const voiceRoutes = express.Router();

voiceRoutes.get(
    "/tickets/voice/token",
    requireAuth,
    bindTenantToUser,
    requirePermission(TICKET_PERMISSIONS.MESSAGE),
    asyncHandler(getVoiceTokenHandler)
);

/**
 * Place outbound call via the tenant's active VoIP/SIP softphone.
 */
voiceRoutes.post(
    "/tickets/voice/outbound",
    requireAuth,
    bindTenantToUser,
    requirePermission(TICKET_PERMISSIONS.MESSAGE),
    validate(placeOutboundCallSchema),
    asyncHandler(placeOutboundCallHandler)
);

/**
 * Log an inbound SIP call answered in the browser softphone.
 */
voiceRoutes.post(
    "/tickets/voice/inbound",
    requireAuth,
    bindTenantToUser,
    requirePermission(TICKET_PERMISSIONS.MESSAGE),
    validate(startInboundSipCallSchema),
    asyncHandler(startInboundSipCallHandler)
);

/**
 * Complete a SIP call (duration / status / optional recording URL).
 */
voiceRoutes.post(
    "/tickets/voice/complete",
    requireAuth,
    bindTenantToUser,
    requirePermission(TICKET_PERMISSIONS.MESSAGE),
    validate(completeSipCallSchema),
    asyncHandler(completeSipCallHandler)
);

voiceRoutes.get(
    "/tickets/voice/recordings/:ticketId",
    requireAuth,
    bindTenantToUser,
    requirePermission(TICKET_PERMISSIONS.VIEW),
    asyncHandler(downloadRecordingHandler)
);

export default voiceRoutes;
