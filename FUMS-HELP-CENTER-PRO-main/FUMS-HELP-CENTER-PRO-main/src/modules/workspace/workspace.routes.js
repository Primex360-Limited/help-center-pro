import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { bindTenantToUser } from "../tenants/tenant.middleware.js";
import { requirePermission } from "../roles/rbac.middleware.js";
import {
    getWorkspaceProfileHandler,
    updateWorkspaceProfileHandler
} from "./workspace.controller.js";
import { updateWorkspaceProfileSchema } from "./workspace.validation.js";

const workspaceRoutes = express.Router();

/**
 * @openapi
 * /workspace/profile:
 *   get:
 *     tags: [Workspace]
 *     summary: Read the organisation profile of the current workspace
 *     description: Requires settings:read. Returns the workspace name, logo and default timezone.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Workspace profile fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkspaceProfileResponse'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
workspaceRoutes.get(
    "/workspace/profile",
    requireAuth,
    bindTenantToUser,
    requirePermission("settings:read"),
    asyncHandler(getWorkspaceProfileHandler)
);

/**
 * @openapi
 * /workspace/profile:
 *   patch:
 *     tags: [Workspace]
 *     summary: Update the organisation profile of the current workspace
 *     description: Requires settings:write. Sends any subset of name, logoUrl and timezone.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateWorkspaceProfileRequest'
 *           examples:
 *             renameWorkspace:
 *               summary: Rename the workspace and set its timezone
 *               value:
 *                 name: Acme Support
 *                 timezone: Africa/Lagos
 *     responses:
 *       200:
 *         description: Workspace profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkspaceProfileResponse'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
workspaceRoutes.patch(
    "/workspace/profile",
    requireAuth,
    bindTenantToUser,
    requirePermission("settings:write"),
    validate(updateWorkspaceProfileSchema),
    asyncHandler(updateWorkspaceProfileHandler)
);

export default workspaceRoutes;
