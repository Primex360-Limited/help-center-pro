import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../roles/rbac.middleware.js";
import { requireProviderScope } from "./tenant.middleware.js";
import {
    activateTenantHandler,
    deleteTenantHandler,
    exportTenantsCsvHandler,
    getPlatformOverviewHandler,
    getTenantHandler,
    inviteTenantHandler,
    listTenantsHandler,
    suspendTenantHandler
} from "./tenant.controller.js";
import {
    createTenantInviteSchema,
    listTenantsQuerySchema,
    tenantIdParamSchema,
    updateTenantStatusSchema
} from "./tenant.validation.js";

const tenantRoutes = express.Router();

/**
 * @openapi
 * /admin/overview:
 *   get:
 *     tags: [Admin]
 *     summary: Platform overview metrics for provider super admins
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Overview metrics
 */
tenantRoutes.get(
    "/admin/overview",
    requireAuth,
    requireProviderScope,
    requirePermission("tenant:manage"),
    asyncHandler(getPlatformOverviewHandler)
);

/**
 * @openapi
 * /admin/tenants:
 *   get:
 *     tags: [Admin]
 *     summary: List all tenant workspaces
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [all, active, suspended, provisioning, trial] }
 *       - in: query
 *         name: plan
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tenant list
 */
tenantRoutes.get(
    "/admin/tenants",
    requireAuth,
    requireProviderScope,
    requirePermission("tenant:manage"),
    validate(listTenantsQuerySchema, "query"),
    asyncHandler(listTenantsHandler)
);

/**
 * @openapi
 * /admin/tenants/export:
 *   get:
 *     tags: [Admin]
 *     summary: Export tenants as CSV
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: CSV file
 */
tenantRoutes.get(
    "/admin/tenants/export",
    requireAuth,
    requireProviderScope,
    requirePermission("tenant:manage"),
    validate(listTenantsQuerySchema, "query"),
    asyncHandler(exportTenantsCsvHandler)
);

/**
 * @openapi
 * /admin/tenants:
 *   post:
 *     tags: [Admin]
 *     summary: Provision a tenant workspace and email an invite link
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [workspaceName, firstName, lastName, email]
 *             properties:
 *               workspaceName: { type: string, example: Primex360 }
 *               primaryDomain: { type: string, example: primex360.com }
 *               plan: { type: string, example: scale }
 *               country: { type: string, example: Nigeria }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, description: Optional temporary password }
 *     responses:
 *       201:
 *         description: Tenant invited
 */
tenantRoutes.post(
    "/admin/tenants",
    requireAuth,
    requireProviderScope,
    requirePermission("tenant:manage"),
    validate(createTenantInviteSchema),
    asyncHandler(inviteTenantHandler)
);

/**
 * @openapi
 * /admin/tenants/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get tenant details
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
tenantRoutes.get(
    "/admin/tenants/:id",
    requireAuth,
    requireProviderScope,
    requirePermission("tenant:manage"),
    validate(tenantIdParamSchema, "params"),
    asyncHandler(getTenantHandler)
);

/**
 * @openapi
 * /admin/tenants/{id}/deactivate:
 *   post:
 *     tags: [Admin]
 *     summary: Suspend / deactivate a tenant workspace
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
tenantRoutes.post(
    "/admin/tenants/:id/deactivate",
    requireAuth,
    requireProviderScope,
    requirePermission("tenant:manage"),
    validate(tenantIdParamSchema, "params"),
    validate(updateTenantStatusSchema),
    asyncHandler(suspendTenantHandler)
);

/**
 * @openapi
 * /admin/tenants/{id}/activate:
 *   post:
 *     tags: [Admin]
 *     summary: Activate a tenant workspace
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
tenantRoutes.post(
    "/admin/tenants/:id/activate",
    requireAuth,
    requireProviderScope,
    requirePermission("tenant:manage"),
    validate(tenantIdParamSchema, "params"),
    asyncHandler(activateTenantHandler)
);

/**
 * @openapi
 * /admin/tenants/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Permanently delete a tenant workspace
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
tenantRoutes.delete(
    "/admin/tenants/:id",
    requireAuth,
    requireProviderScope,
    requirePermission("tenant:manage"),
    validate(tenantIdParamSchema, "params"),
    asyncHandler(deleteTenantHandler)
);

export default tenantRoutes;
