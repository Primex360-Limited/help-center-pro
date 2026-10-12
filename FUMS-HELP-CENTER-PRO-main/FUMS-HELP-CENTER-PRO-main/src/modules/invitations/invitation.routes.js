import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { bindTenantToUser } from "../tenants/tenant.middleware.js";
import { requirePermission } from "../roles/rbac.middleware.js";
import { 
    createInvitationHandler,
    previewInvitationHandler,
    acceptInvitationHandler 
} from "./invitation.controller.js";

import {
    acceptInvitationSchema,
    createInvitationSchema,
    previewInvitationSchema,
} from "./invitation.validation.js";

const invitationRoutes = express.Router();

/**
 * @openapi
 * /invitations:
 *   post:
 *     tags: [Invitations]
 *     summary: Invite an Admin or Agent to the workspace
 *     description: Requires agent:invite. Sends a premium email with accept link and temporary password. firstName/lastName are optional and derived from email when omitted.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInvitationRequest'
 *           examples:
 *             agentInvite:
 *               summary: Invite Agent by email + role
 *               value:
 *                 email: agent@company.com
 *                 roleId: 3f1a2b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b
 *     responses:
 *       201:
 *         description: Invitation sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvitationResponse'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
invitationRoutes.post(
    "/invitations",
    requireAuth,
    bindTenantToUser,
    requirePermission("agent:invite"),
    validate(createInvitationSchema),
    asyncHandler(createInvitationHandler)
);

/**
 * @openapi
 * /invitations/preview:
 *   get:
 *     tags: [Invitations]
 *     summary: Preview invitation
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvitationPreviewResponse'
 *       400:
 *         description: Invalid or expired invitation token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
invitationRoutes.get(
    "/invitations/preview",
    validate(previewInvitationSchema, "query"),
    asyncHandler(previewInvitationHandler)
)

/**
 * @openapi
 * /invitations/accept:
 *   post:
 *     tags: [Invitations]
 *     summary: Accept invitation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AcceptInvitationRequest'
 *     responses:
 *       200:
 *         description: Invitation activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvitationActivationResponse'
 *       400:
 *         description: Invalid or expired invitation token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
invitationRoutes.post(
    "/invitations/accept",
    validate(acceptInvitationSchema),
    asyncHandler(acceptInvitationHandler)
)

export default invitationRoutes;