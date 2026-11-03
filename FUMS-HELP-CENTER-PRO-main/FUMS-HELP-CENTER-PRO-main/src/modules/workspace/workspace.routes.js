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
    updateWorkspaceProfileHandler,
    getVoipSettingsHandler,
    saveVoipSettingsHandler,
    testVoipConnectionHandler,
    discoverVoipWebSocketHandler,
    getApiKeysHandler,
    regenerateApiKeysHandler,
    getWebhooksHandler,
    saveWebhooksHandler,
    getBillingHandler,
    initializePaystackHandler,
    verifyPaystackHandler
} from "./workspace.controller.js";
import {
    updateCallingSettingsSchema,
    updateWorkspaceProfileSchema,
    apiKeyModeParamSchema,
    saveWebhooksSchema,
    paystackInitializeSchema,
    paystackVerifySchema,
    discoverVoipWebSocketSchema
} from "./workspace.validation.js";
import { requireWorkspaceTenant } from "../tenants/require-workspace-tenant.js";

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

/**
 * @openapi
 * /workspace/voip:
 *   get:
 *     tags: [Workspace]
 *     summary: Get VoIP/SIP provider configurations
 *     description: Requires settings:read. Returns all configured VoIP providers and the active one.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: VoIP settings fetched successfully
 *       403:
 *         description: Forbidden
 */
workspaceRoutes.get(
    "/workspace/voip",
    requireAuth,
    bindTenantToUser,
    requirePermission("settings:read"),
    asyncHandler(getVoipSettingsHandler)
);

/**
 * @openapi
 * /workspace/voip:
 *   patch:
 *     tags: [Workspace]
 *     summary: Save VoIP/SIP provider configurations
 *     description: Requires settings:write. Saves provider configurations and sets active provider.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               configurations:
 *                 type: array
 *                 items:
 *                   type: object
 *               activeConfigId:
 *                 type: string
 *     responses:
 *       200:
 *         description: VoIP settings saved successfully
 *       403:
 *         description: Forbidden
 */
workspaceRoutes.patch(
    "/workspace/voip",
    requireAuth,
    bindTenantToUser,
    requirePermission("settings:write"),
    asyncHandler(saveVoipSettingsHandler)
);

/**
 * @openapi
 * /workspace/voip/test/{configId}:
 *   post:
 *     tags: [Workspace]
 *     summary: Test connection to a VoIP provider
 *     description: Requires settings:write. Validates credentials and connectivity.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection test result
 *       403:
 *         description: Forbidden
 */
workspaceRoutes.post(
    "/workspace/voip/test/:configId",
    requireAuth,
    bindTenantToUser,
    requirePermission("settings:write"),
    asyncHandler(testVoipConnectionHandler)
);

/**
 * @openapi
 * /workspace/voip/discover-ws:
 *   post:
 *     tags: [Workspace]
 *     summary: Discover the provider's SIP-over-WebSocket endpoint
 *     description: >
 *       Probes DNS SRV records plus the conventional Asterisk / FreeSWITCH /
 *       Kamailio WebSocket ports and paths, confirming each candidate with a
 *       real `101 Switching Protocols` handshake and a browser-trusted
 *       certificate. Lets a browser softphone register with SIP providers that
 *       only publish an IP + UDP port. Send `persist: true` (requires
 *       settings:write) to store the result on the provider configuration so
 *       every agent inherits it.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               configId:
 *                 type: string
 *               providerId:
 *                 type: string
 *               host:
 *                 type: string
 *               providerDomain:
 *                 type: string
 *               providerWsUrl:
 *                 type: string
 *               persist:
 *                 type: boolean
 *               force:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Ranked WebSocket candidates plus the best usable endpoint
 *       403:
 *         description: Forbidden
 */
workspaceRoutes.post(
    "/workspace/voip/discover-ws",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    validate(discoverVoipWebSocketSchema),
    asyncHandler(discoverVoipWebSocketHandler)
);

/**
 * @openapi
 * /workspace/api-keys:
 *   get:
 *     tags: [Workspace]
 *     summary: Get test and live API key prefixes
 *     description: Returns public/secret key prefixes for test and live modes. Full secrets are only returned once on regenerate.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: API key summary
 *       403:
 *         description: Forbidden
 */
workspaceRoutes.get(
    "/workspace/api-keys",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("settings:read"),
    asyncHandler(getApiKeysHandler)
);

/**
 * @openapi
 * /workspace/api-keys/{mode}/regenerate:
 *   post:
 *     tags: [Workspace]
 *     summary: Regenerate test or live API key pair
 *     description: Rotates pk_* and sk_* for the given mode. Secret is returned once in the response.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: mode
 *         required: true
 *         schema:
 *           type: string
 *           enum: [test, live]
 *     responses:
 *       200:
 *         description: New publicKey and secretKey
 *       403:
 *         description: Forbidden
 */
workspaceRoutes.post(
    "/workspace/api-keys/:mode/regenerate",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("settings:write"),
    validate(apiKeyModeParamSchema, "params"),
    asyncHandler(regenerateApiKeysHandler)
);

/**
 * @openapi
 * /workspace/webhooks:
 *   get:
 *     tags: [Workspace]
 *     summary: Get outbound webhook configuration
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Endpoint URL, signing secret, and event toggles
 *   put:
 *     tags: [Workspace]
 *     summary: Save outbound webhook configuration
 *     description: |
 *       Persist endpoint URL and subscribed events. Set `generateSecret: true` to rotate `whsec_…`.
 *       Deliveries POST JSON with headers `X-HCP-Signature` (HMAC-SHA256 hex of raw body) and `X-HCP-Event`.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endpointUrl:
 *                 type: string
 *                 example: https://api.example.com/webhook/helpcenter
 *               signingSecret:
 *                 type: string
 *               generateSecret:
 *                 type: boolean
 *               events:
 *                 type: object
 *                 properties:
 *                   ticket.created: { type: boolean }
 *                   ticket.updated: { type: boolean }
 *                   ticket.resolved: { type: boolean }
 *                   customer.created: { type: boolean }
 *     responses:
 *       200:
 *         description: Webhook settings saved
 */
workspaceRoutes.get(
    "/workspace/webhooks",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("settings:read"),
    asyncHandler(getWebhooksHandler)
);

workspaceRoutes.put(
    "/workspace/webhooks",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("settings:write"),
    validate(saveWebhooksSchema),
    asyncHandler(saveWebhooksHandler)
);

/**
 * @openapi
 * /workspace/billing:
 *   get:
 *     tags: [Workspace]
 *     summary: Get current tenant plan and billing status
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current plan (free|premium), price, and upgrade metadata
 */
workspaceRoutes.get(
    "/workspace/billing",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("settings:read"),
    asyncHandler(getBillingHandler)
);

/**
 * @openapi
 * /workspace/billing/paystack/initialize:
 *   post:
 *     tags: [Workspace]
 *     summary: Start Paystack checkout for Premium upgrade
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: authorization_url and reference for Paystack
 */
workspaceRoutes.post(
    "/workspace/billing/paystack/initialize",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("settings:write"),
    validate(paystackInitializeSchema),
    asyncHandler(initializePaystackHandler)
);

/**
 * @openapi
 * /workspace/billing/paystack/verify:
 *   post:
 *     tags: [Workspace]
 *     summary: Verify Paystack payment and activate Premium
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reference]
 *             properties:
 *               reference:
 *                 type: string
 *     responses:
 *       200:
 *         description: Billing updated to premium
 */
workspaceRoutes.post(
    "/workspace/billing/paystack/verify",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("settings:write"),
    validate(paystackVerifySchema),
    asyncHandler(verifyPaystackHandler)
);

export default workspaceRoutes;
