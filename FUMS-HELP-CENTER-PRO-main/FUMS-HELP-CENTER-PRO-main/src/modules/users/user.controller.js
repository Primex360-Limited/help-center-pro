import successResponse from "../../shared/utils/apiResponse.js";
import {
    deleteUser,
    getUserById,
    getUsers,
    updateUser
} from "./user.service.js";

export async function getUsersHandler(req, res) {
    const users = await getUsers();

    return successResponse(res, "Users fetched successfully", { users });
}

export async function getUserHandler(req, res) {
    const user = await getUserById(req.params.id);

    return successResponse(res, "User fetched successfully", { user });
}

export async function updateUserHandler(req, res) {
    const user = await updateUser(req.params.id, req.validatedBody, req.user.sub);

    return successResponse(res, "User updated successfully", { user });
}

export async function deleteUserHandler(req, res) {
    await deleteUser(req.params.id);

    return successResponse(res, "User deleted successfully");
}