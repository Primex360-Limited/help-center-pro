import successResponse from "../../shared/utils/apiResponse.js";
import {
    createRole,
    getRoles,
    getRoleById,
    updateRole
} from "./role.service.js";

/**
 * Tenant scope convention (see `role.service.js`):
 *   `undefined` -> provider-wide view, `null` -> provider rows, UUID -> that workspace.
 */
function requestTenantId(req) {
    const tenantId =
        req.tenantId !== undefined ? req.tenantId : req.user?.tenant_id;

    return tenantId === undefined ? undefined : tenantId ?? null;
}

export async function createRoleHandler(req, res) {
    const role = await createRole({
        ...req.validatedBody,
        tenantId: requestTenantId(req),
        createdBy: req.user.sub
    });

    return successResponse(res, "Role created successfully", { role }, 201);
}

export async function getRolesHandler(req, res) {
    const roles = await getRoles(requestTenantId(req));

    return successResponse(res, "Role fetched successfully", { roles });
}

export async function getRoleHandler(req, res) {
    const role = await getRoleById(req.params.id, requestTenantId(req));

    return successResponse(res, "Role fetched successfully", { role });
}

export async function updateRoleHandler(req, res) {
    const role = await updateRole(
        req.params.id,
        req.validatedBody,
        req.user.sub,
        requestTenantId(req)
    );

    return successResponse(res, "Role updated successfully", { role });
}