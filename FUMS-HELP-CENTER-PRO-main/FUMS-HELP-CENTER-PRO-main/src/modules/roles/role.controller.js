import successResponse from "../../shared/utils/apiResponse.js";
import {
    createRole,
    getRoles,
    getRoleById,
    updateRole
} from "./role.service.js";

export async function createRoleHandler(req, res) {
    const role = await createRole({
        ...req.validatedBody,
        createdBy: req.user.sub
    });

    return successResponse(res, "Role created successfully", { role }, 201);
}

export async function getRolesHandler(req, res) {
    const roles = await getRoles();

    return successResponse(res, "Role fetched successfully", { roles });
}

export async function getRoleHandler(req, res) {
    const role = await getRoleById(req.params.id);

    return successResponse(res, "Role fetched successfully", { role });
}

export async function updateRoleHandler(req, res) {
    const role = await updateRole(req.params.id, req.validatedBody, req.user.sub);

    return successResponse(res, "Role updated successfully", { role });
}