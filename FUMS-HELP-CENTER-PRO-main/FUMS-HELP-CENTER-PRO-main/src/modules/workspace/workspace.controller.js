import successResponse from "../../shared/utils/apiResponse.js";
import {
    generateCallNumber,
    generateWidgetApiKey,
    getWorkspaceProfile,
    updateCallingSettings,
    updateWorkspaceProfile,
    getVoipSettings,
    saveVoipSettings,
    testVoipConnection,
    discoverVoipWebSocket
} from "./workspace.service.js";
import { getEffectivePermissionsFromUser, isSuperAdminUser } from "../roles/role.service.js";
import { normalizePermissionKey } from "../../shared/utils/permissionKey.js";
import { getApiKeys, regenerateApiKeys } from "./api-keys.service.js";
import { getWebhooks, saveWebhooks } from "./webhooks.service.js";
import {
    getBilling,
    initializePaystackPayment,
    verifyPaystackPayment
} from "./billing.service.js";

/**
 * `req.tenantId` is authoritative when `requireAuth` + `bindTenantToUser` are
 * mounted (it is `null` for provider scope); the token claim is only a fallback
 * for a provider operator acting inside a specific workspace.
 */
function resolveTenantId(req) {
    if (req.tenantId !== undefined) {
        return req.tenantId;
    }

    return req.user?.tenant_id ?? null;
}

function resolveActorId(req) {
    return req.user?.sub || req.user?.id;
}

export async function getWorkspaceProfileHandler(req, res) {
    const result = await getWorkspaceProfile({ tenantId: resolveTenantId(req) });

    return successResponse(res, "Workspace profile fetched successfully", result);
}

export async function updateWorkspaceProfileHandler(req, res) {
    const result = await updateWorkspaceProfile({
        tenantId: resolveTenantId(req),
        payload: req.validatedBody,
        actorId: req.user?.sub || req.user?.id
    });

    return successResponse(
        res,
        "Workspace profile updated successfully",
        result
    );
}

export async function generateCallNumberHandler(req, res) {
    const result = await generateCallNumber({
        tenantId: resolveTenantId(req),
        actorId: req.user?.sub || req.user?.id
    });

    return successResponse(res, result.message, {
        workspace: result.workspace,
        number: result.number
    });
}

export async function updateCallingSettingsHandler(req, res) {
    const result = await updateCallingSettings({
        tenantId: resolveTenantId(req),
        payload: req.validatedBody,
        actorId: req.user?.sub || req.user?.id
    });

    return successResponse(res, result.message, {
        workspace: result.workspace
    });
}

export async function generateWidgetApiKeyHandler(req, res) {
    const result = await generateWidgetApiKey({
        tenantId: resolveTenantId(req),
        actorId: req.user?.sub || req.user?.id
    });

    return successResponse(res, result.message, {
        workspace: result.workspace,
        apiKey: result.apiKey
    });
}

export async function getVoipSettingsHandler(req, res) {
    const result = await getVoipSettings({ tenantId: resolveTenantId(req) });

    return successResponse(res, "VoIP settings fetched successfully", result);
}

export async function saveVoipSettingsHandler(req, res) {
    const result = await saveVoipSettings({
        tenantId: resolveTenantId(req),
        payload: req.validatedBody || req.body || {},
        actorId: req.user?.sub || req.user?.id
    });

    return successResponse(res, "VoIP settings saved successfully", result);
}

export async function testVoipConnectionHandler(req, res) {
    const result = await testVoipConnection({
        tenantId: resolveTenantId(req),
        configId: req.params.configId,
        actorId: resolveActorId(req)
    });

    return successResponse(res, result.message, {
        success: result.success,
        details: result.details
    });
}

/**
 * Does the caller hold `settings:write`? Discovery only writes when it does, so
 * an agent can trigger it from the softphone without gaining settings access.
 */
function callerCanWriteSettings(req) {
    try {
        if (isSuperAdminUser(req.currentUser || {})) return true;
        const permissions = getEffectivePermissionsFromUser(req.currentUser || {}).map(
            (permission) => normalizePermissionKey(permission)
        );
        return permissions.includes("settings:write");
    } catch {
        return false;
    }
}

export async function discoverVoipWebSocketHandler(req, res) {
    const result = await discoverVoipWebSocket({
        tenantId: resolveTenantId(req),
        payload: req.validatedBody || req.body || {},
        canWrite: callerCanWriteSettings(req),
        actorId: resolveActorId(req)
    });

    const message = result.wsUrl
        ? result.source === "tenant"
            ? result.verified
                ? "Saved WebSocket URL verified"
                : "Saved WebSocket URL did not answer the probe"
            : result.source === "platform"
              ? "Using the platform WebRTC gateway"
              : "WebSocket endpoint discovered"
        : "No WebSocket endpoint could be verified";

    return successResponse(res, message, result);
}

export async function getApiKeysHandler(req, res) {
    const result = await getApiKeys({ tenantId: resolveTenantId(req) });
    return successResponse(res, "API keys fetched successfully", result);
}

export async function regenerateApiKeysHandler(req, res) {
    const result = await regenerateApiKeys({
        tenantId: resolveTenantId(req),
        mode: req.validatedParams?.mode || req.params.mode,
        actorId: resolveActorId(req)
    });
    return successResponse(res, result.message, {
        mode: result.mode,
        publicKey: result.publicKey,
        secretKey: result.secretKey,
        publicKeyPrefix: result.publicKeyPrefix,
        secretKeyPrefix: result.secretKeyPrefix,
        updatedAt: result.updatedAt,
        previousKeysRevoked: result.previousKeysRevoked === true
    });
}

export async function getWebhooksHandler(req, res) {
    const result = await getWebhooks({ tenantId: resolveTenantId(req) });
    return successResponse(res, "Webhooks fetched successfully", result);
}

export async function saveWebhooksHandler(req, res) {
    const result = await saveWebhooks({
        tenantId: resolveTenantId(req),
        payload: req.validatedBody || req.body || {},
        actorId: resolveActorId(req)
    });
    return successResponse(res, result.message, {
        webhooks: result.webhooks
    });
}

export async function getBillingHandler(req, res) {
    const result = await getBilling({ tenantId: resolveTenantId(req) });
    return successResponse(res, "Billing fetched successfully", result);
}

export async function initializePaystackHandler(req, res) {
    const result = await initializePaystackPayment({
        tenantId: resolveTenantId(req),
        email: req.validatedBody?.email,
        actorId: resolveActorId(req)
    });
    return successResponse(res, "Paystack transaction initialized", result);
}

export async function verifyPaystackHandler(req, res) {
    const result = await verifyPaystackPayment({
        tenantId: resolveTenantId(req),
        reference: req.validatedBody?.reference,
        actorId: resolveActorId(req)
    });
    return successResponse(res, result.message, {
        billing: result.billing,
        tenant: result.tenant
    });
}

