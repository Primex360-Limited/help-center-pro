import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
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
 *     summary: Invite user to role
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInvitationRequest'
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
    requirePermission("manage_users"),
    validate(createInvitationSchema),
    asyncHandler(createInvitationHandler)
)

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