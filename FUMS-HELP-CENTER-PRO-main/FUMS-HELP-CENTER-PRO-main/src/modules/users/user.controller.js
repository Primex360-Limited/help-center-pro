import successResponse from "../../shared/utils/apiResponse.js";
import {
    deleteUser,
    getUserById,
    getUsers,
    getUsersWithTicketStats,
    updateUser
} from "./user.service.js";

/**
 * Tenant scope convention (see `user.service.js`):
 *   `undefined` -> provider-wide view, `null` -> provider accounts, UUID -> that workspace.
 */
function requestTenantId(req) {
    const tenantId =
        req.tenantId !== undefined ? req.tenantId : req.user?.tenant_id;

    return tenantId === undefined ? undefined : tenantId ?? null;
}

export async function getUsersHandler(req, res) {
    const includeStats = String(req.query?.includeStats || "").toLowerCase() === "true";
    const users = includeStats
        ? await getUsersWithTicketStats(requestTenantId(req))
        : await getUsers(requestTenantId(req));

    return successResponse(res, "Users fetched successfully", { users });
}

export async function getUserHandler(req, res) {
    const user = await getUserById(req.params.id, requestTenantId(req));

    return successResponse(res, "User fetched successfully", { user });
}

export async function updateUserHandler(req, res) {
    const user = await updateUser(
        req.params.id,
        req.validatedBody,
        req.user?.sub ?? null,
        requestTenantId(req)
    );

    return successResponse(res, "User updated successfully", { user });
}

export async function deleteUserHandler(req, res) {
    await deleteUser(req.params.id, req.user?.sub ?? null, requestTenantId(req));

    return successResponse(res, "User deleted successfully");
}
