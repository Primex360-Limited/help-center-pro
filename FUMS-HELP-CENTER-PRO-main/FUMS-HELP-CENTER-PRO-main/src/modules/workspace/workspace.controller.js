import successResponse from "../../shared/utils/apiResponse.js";
import {
    getWorkspaceProfile,
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
        actorId: req.user?.sub
    });

    return successResponse(
        res,
        "Workspace profile updated successfully",
        result
    );
}
