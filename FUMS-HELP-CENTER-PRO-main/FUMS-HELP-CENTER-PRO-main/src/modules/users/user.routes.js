import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { bindTenantToUser } from "../tenants/tenant.middleware.js";
import { requireWorkspaceTenant } from "../tenants/require-workspace-tenant.js";
import { requirePermission } from "../roles/rbac.middleware.js";
import {
    deleteUserHandler,
    getUserHandler,
    getUsersHandler,
    updateUserHandler,
} from "./user.controller.js";
import { updateUserSchema, userIdParamSchema } from "./user.validation.js";

const userRoutes = express.Router();

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Get all workspace users / agents
 *     description: Pass includeStats=true to attach live Assigned / Open / Resolved ticket counters for the Agents screen.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: includeStats
 *         schema:
 *           type: boolean
 *         description: When true, each user includes ticketStats { assigned, open, resolved }
 *     responses:
 *       200:
 *         description: Users fetched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserListResponse'
 */
userRoutes.get(
    "/users",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("agent:read"),
    asyncHandler(getUsersHandler)
);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a single user
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User fetched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 */
userRoutes.get(
    "/users/:id",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("agent:read"),
    validate(userIdParamSchema, "params"),
    asyncHandler(getUserHandler)
);

/**
 * @openapi
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Update a user, including status, role assignment, and denied permissions
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 */
userRoutes.patch(
    "/users/:id",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("agent:update"),
    validate(userIdParamSchema, "params"),
    validate(updateUserSchema),
    asyncHandler(updateUserHandler)
);

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete user
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessageResponse'
 */
userRoutes.delete(
    "/users/:id",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("agent:deactivate"),
    validate(userIdParamSchema, "params"),
    asyncHandler(deleteUserHandler)
);

export default userRoutes;