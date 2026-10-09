import express from "express";
import asyncHandler from "../../../middleware/async.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../roles/rbac.middleware.js";
import { TICKET_PERMISSIONS } from "../ticket.constants.js";
import { ticketIdParamSchema } from "../ticket.validation.js";
import {
    replyToTicketByEmailHandler,
    resendInboundEmailWebhookHandler
} from "./support-email.controller.js";
import {
    emailReplySchema,
    resendInboundEmailWebhookSchema
} from "./support-email.validation.js";

const supportEmailRoutes = express.Router();

/**
 * @openapi
 * /tickets/email/webhooks/resend:
 *   post:
 *     tags: [Tickets]
 *     summary: Receive inbound support emails from Resend
 *     description: Resend calls this webhook for email.received events. The route uses Resend webhook verification when RESEND_WEBHOOK_SECRET is configured.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResendInboundEmailWebhookRequest'
 *     responses:
 *       200:
 *         description: Inbound email processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InboundEmailWebhookResponse'
 */
supportEmailRoutes.post(
    "/tickets/email/webhooks/resend",
    validate(resendInboundEmailWebhookSchema),
    asyncHandler(resendInboundEmailWebhookHandler)
);

/**
 * @openapi
 * /tickets/{ticketId}/email/reply:
 *   post:
 *     tags: [Tickets]
 *     summary: Send an agent email reply and append it to the ticket thread
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailReplyRequest'
 *     responses:
 *       201:
 *         description: Email reply sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmailReplyResponse'
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
