import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { bindTenantToUser } from "../tenants/tenant.middleware.js";
import { requirePermission } from "../roles/rbac.middleware.js";
import {
    generateCallNumberHandler,
    generateWidgetApiKeyHandler,
    getWorkspaceProfileHandler,
    updateCallingSettingsHandler,
    updateWorkspaceProfileHandler
} from "./workspace.controller.js";
import {
    updateCallingSettingsSchema,
    updateWorkspaceProfileSchema
} from "./workspace.validation.js";

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

/**
 * @openapi
 * /workspace/integrations/widget-api-key:
 *   post:
 *     tags: [Workspace]
 *     summary: Generate a chat widget API key
 *     description: |
 *       Creates a new API key for embedding Help Centre Pro chat in the tenant's app.
 *       Customer details from the widget appear on tickets. The raw key is returned once.
 *       Help Centre Pro provisions call numbers separately; tenants connect their own email
 *       via PATCH /workspace/profile { supportEmail }.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: API key generated (shown once)
 *       403:
 *         description: Forbidden
 */
workspaceRoutes.post(
    "/workspace/integrations/widget-api-key",
    requireAuth,
    bindTenantToUser,
    requirePermission("settings:write"),
    asyncHandler(generateWidgetApiKeyHandler)
);

workspaceRoutes.post(
    "/workspace/call-number/generate",
    requireAuth,
    bindTenantToUser,
    requirePermission("settings:write"),
    asyncHandler(generateCallNumberHandler)
);

workspaceRoutes.patch(
    "/workspace/calling",
    requireAuth,
    bindTenantToUser,
    requirePermission("settings:write"),
    validate(updateCallingSettingsSchema),
    asyncHandler(updateCallingSettingsHandler)
);

export default workspaceRoutes;
