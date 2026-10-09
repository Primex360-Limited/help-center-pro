import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "./rbac.middleware.js";
import {
    createRoleHandler,
    getRoleHandler,
    getRolesHandler,
    updateRoleHandler
} from "./role.controller.js";
import {
    createRoleSchema,
    roleIdParamSchema,
    updateRoleSchema
} from "./role.validation.js";

const roleRoutes = express.Router();

/**
 * @openapi
 * /roles:
 *   post:
 *     tags: [Roles]
 *     summary: Create role
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRoleRequest'
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleResponse'
 *       409:
 *         description: Role already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
roleRoutes.post(
    "/roles",
    requireAuth,
    requirePermission("manage_roles"),
    validate(createRoleSchema),
    asyncHandler(createRoleHandler)
);

/**
 * @openapi
 * /roles/all:
 *   get:
 *     tags: [Roles]
 *     summary: Get all roles
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Roles fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleListResponse'
 */
roleRoutes.get(
    "/roles/all",
    requireAuth,
    requirePermission("manage_roles", "manage_users"),
    asyncHandler(getRolesHandler)
);

/**
 * @openapi
 * /roles/{id}:
 *   get:
 *     tags: [Roles]
 *     summary: Get a single role
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
 *         description: Role fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleResponse'
 *       404:
 *         description: Role not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
roleRoutes.get(
    "/roles/:id",
    requireAuth,
    requirePermission("manage_roles"),
    validate(roleIdParamSchema, "params"),
    asyncHandler(getRoleHandler)
);

/**
 * @openapi
 * /roles/{id}:
 *   patch:
 *     tags: [Roles]
 *     summary: Update a role
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
 *             $ref: '#/components/schemas/UpdateRoleRequest'
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleResponse'
 *       404:
 *         description: Role not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
roleRoutes.patch(
    "/roles/:id",
    requireAuth,
    requirePermission("manage_roles"),
    validate(roleIdParamSchema, "params"),
    validate(updateRoleSchema),
    asyncHandler(updateRoleHandler)
);

export default roleRoutes;