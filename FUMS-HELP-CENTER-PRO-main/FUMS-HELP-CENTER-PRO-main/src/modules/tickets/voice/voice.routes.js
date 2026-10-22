import express from "express";
import asyncHandler from "../../../middleware/async.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { bindTenantToUser } from "../../tenants/tenant.middleware.js";
import { requirePermission } from "../../roles/rbac.middleware.js";
import { TICKET_PERMISSIONS } from "../ticket.constants.js";
import {
    browserOutboundTwimlHandler,
    connectCustomerTwimlHandler,
    downloadRecordingHandler,
    getVoiceTokenHandler,
    outboundCustomerTwimlHandler,
    placeOutboundCallHandler,
    twilioRecordingWebhookHandler,
    twilioStatusWebhookHandler
} from "./voice.controller.js";
import { placeOutboundCallSchema } from "./voice.validation.js";

const voiceRoutes = express.Router();

voiceRoutes.get(
    "/tickets/voice/token",
    requireAuth,
    bindTenantToUser,
    requirePermission(TICKET_PERMISSIONS.MESSAGE),
    asyncHandler(getVoiceTokenHandler)
);

/**
 * Place outbound call from the workspace HelpCentre Pro / Twilio line.
 * Agents only supply the customer number — caller ID comes from settings.
 */
voiceRoutes.post(
    "/tickets/voice/outbound",
    requireAuth,
    bindTenantToUser,
    requirePermission(TICKET_PERMISSIONS.MESSAGE),
    validate(placeOutboundCallSchema),
    asyncHandler(placeOutboundCallHandler)
);

voiceRoutes.get(
    "/tickets/voice/recordings/:ticketId",
    requireAuth,
    bindTenantToUser,
    requirePermission(TICKET_PERMISSIONS.VIEW),
    asyncHandler(downloadRecordingHandler)
);

voiceRoutes.post(
    "/tickets/voice/twiml/connect-customer",
    asyncHandler(connectCustomerTwimlHandler)
);
voiceRoutes.get(
    "/tickets/voice/twiml/connect-customer",
    asyncHandler(connectCustomerTwimlHandler)
);

/**
 * TwiML App Voice URL for browser softphone calls.
 * Point your Twilio TwiML App's Voice URL here (POST).
 */
voiceRoutes.post(
    "/tickets/voice/twiml/browser-outbound",
    asyncHandler(browserOutboundTwimlHandler)
);
voiceRoutes.get(
    "/tickets/voice/twiml/browser-outbound",
    asyncHandler(browserOutboundTwimlHandler)
);

voiceRoutes.post(
    "/tickets/voice/twiml/outbound-customer",
    asyncHandler(outboundCustomerTwimlHandler)
);
voiceRoutes.get(
    "/tickets/voice/twiml/outbound-customer",
    asyncHandler(outboundCustomerTwimlHandler)
);

voiceRoutes.post(
    "/tickets/voice/twiml/outbound",
    asyncHandler(outboundCustomerTwimlHandler)
);
voiceRoutes.get(
    "/tickets/voice/twiml/outbound",
    asyncHandler(outboundCustomerTwimlHandler)
);

voiceRoutes.post(
    "/tickets/voice/webhooks/status",
    asyncHandler(twilioStatusWebhookHandler)
);

voiceRoutes.post(
    "/tickets/voice/webhooks/recording",
    asyncHandler(twilioRecordingWebhookHandler)
);

export default voiceRoutes;
