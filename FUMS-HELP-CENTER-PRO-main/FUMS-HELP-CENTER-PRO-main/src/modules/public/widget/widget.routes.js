import express from "express";
import asyncHandler from "../../../middleware/async.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import { requireWidgetApiKey } from "./widget.middleware.js";
import {
    createVisitorHandler,
    listMessagesHandler,
    sendMessageHandler,
    sessionHandler,
    ticketSettingsHandler
} from "./widget.controller.js";
import {
    widgetListMessagesQuerySchema,
    widgetMessageSchema,
    widgetVisitorSchema
} from "./widget.validation.js";

const widgetPublicRoutes = express.Router();

/**
 * Public LiveAgent-style widget API — authenticated by API key only.
 *
 * @openapi
 * /public/widget/visitor:
 *   post:
 *     tags: [Public Widget]
 *     summary: Collect visitor identity and open a live-chat ticket
 *     description: |
 *       Authenticate with `X-HCP-API-Key: pk_test_…` / `pk_live_…` or
 *       `Authorization: Bearer sk_test_…` / `sk_live_…`.
 *       Production base: https://helpcentre-pro-api.onrender.com/api/v1
 *     security:
 *       - hcpApiKey: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email, description: Optional }
 *               phone: { type: string, description: Optional }
 *               name: { type: string, description: Optional }
 *               message: { type: string, description: Optional opening message }
 *     responses:
 *       201:
 *         description: Visitor stored and ticket created
 *       401:
 *         description: Invalid or missing API key
 */
widgetPublicRoutes.post(
    "/public/widget/visitor",
    requireWidgetApiKey,
    validate(widgetVisitorSchema),
    asyncHandler(createVisitorHandler)
);

/**
 * @openapi
 * /public/widget/messages:
 *   post:
 *     tags: [Public Widget]
 *     summary: Append a customer message to an existing ticket
 *     security:
 *       - hcpApiKey: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ticketId, message]
 *             properties:
 *               ticketId: { type: string, example: TK-00042 }
 *               message: { type: string }
 *               email: { type: string, format: email, description: Optional }
 *               name: { type: string, description: Optional }
 *               phone: { type: string, description: Optional }
 *               role: { type: string, enum: [customer, agent], description: "Secret key only. Default customer. Pass agent for automated agent replies." }
 *     responses:
 *       200:
 *         description: Message appended
 *       404:
 *         description: Ticket not found
 */
widgetPublicRoutes.post(
    "/public/widget/messages",
    requireWidgetApiKey,
    validate(widgetMessageSchema),
    asyncHandler(sendMessageHandler)
);

/**
 * @openapi
 * /public/widget/messages:
 *   get:
 *     tags: [Public Widget]
 *     summary: Poll chat messages (customer + agent replies)
 *     description: |
 *       External chatbots must poll this endpoint so agent replies appear
 *       in the visitor UI. Pass `after` (ISO timestamp) to fetch only new rows.
 *     security:
 *       - hcpApiKey: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ticketId
 *         required: true
 *         schema: { type: string, example: TK-00019 }
 *       - in: query
 *         name: after
 *         required: false
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 100 }
 *     responses:
 *       200:
 *         description: Message list for the ticket
 *       404:
 *         description: Ticket not found
 */
widgetPublicRoutes.get(
    "/public/widget/messages",
    requireWidgetApiKey,
    validate(widgetListMessagesQuerySchema, "query"),
    asyncHandler(listMessagesHandler)
);

/**
 * @openapi
 * /public/widget/session:
 *   get:
 *     tags: [Public Widget]
 *     summary: Resolve workspace for the API key
 *     security:
 *       - hcpApiKey: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workspace + key mode
 */
widgetPublicRoutes.get(
    "/public/widget/session",
    requireWidgetApiKey,
    asyncHandler(sessionHandler)
);

/**
 * @openapi
 * /public/widget/ticket-settings:
 *   get:
 *     tags: [Public Widget]
 *     summary: Read workspace ticket inactivity policy
 *     description: |
 *       Returns how long an open ticket may sit without activity before
 *       Help Centre Pro auto-closes it. Configure in Settings → General.
 *       Authenticate with your workspace API key (`pk_` / `sk_`).
 *     security:
 *       - hcpApiKey: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ticket policy for the authenticated workspace
 */
widgetPublicRoutes.get(
    "/public/widget/ticket-settings",
    requireWidgetApiKey,
    asyncHandler(ticketSettingsHandler)
);

export default widgetPublicRoutes;
