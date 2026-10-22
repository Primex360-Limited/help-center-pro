import express from "express";
import asyncHandler from "../../../middleware/async.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../roles/rbac.middleware.js";
import { TICKET_PERMISSIONS } from "../ticket.constants.js";
import { ticketIdParamSchema } from "../ticket.validation.js";
import { replyToTicketByEmailHandler } from "./support-email.controller.js";
import { emailReplySchema } from "./support-email.validation.js";

const supportEmailRoutes = express.Router();

/**
 * Agent email reply — sent directly through the agent's connected mailbox
 * (SMTP/IMAP, see Settings → Email) or platform SMTP. Inbound customer mail
 * arrives via IMAP mailbox sync; there is no third-party webhook.
 */
supportEmailRoutes.post(
    "/tickets/:ticketId/email/reply",
    requireAuth,
    requirePermission(TICKET_PERMISSIONS.MESSAGE),
    validate(ticketIdParamSchema, "params"),
    validate(emailReplySchema),
    asyncHandler(replyToTicketByEmailHandler)
);

export default supportEmailRoutes;
