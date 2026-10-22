import successResponse from "../../shared/utils/apiResponse.js";
import {
    generateCallNumber,
    generateWidgetApiKey,
    getWorkspaceProfile,
    updateCallingSettings,
    updateWorkspaceProfile
} from "./workspace.service.js";

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
