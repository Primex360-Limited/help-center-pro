import express from "express";
import asyncHandler from "../../../middleware/async.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import { requireWidgetApiKey } from "./widget.middleware.js";
import {
    createVisitorHandler,
    sendMessageHandler
} from "./widget.controller.js";
import {
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
 *       Production base: https://helpcentre-pro-admin.onrender.com/api/v1
 *     security:
 *       - hcpApiKey: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               name: { type: string }
 *               message: { type: string }
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
 *               email: { type: string, format: email }
 *               name: { type: string }
 *               phone: { type: string }
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

export default widgetPublicRoutes;
