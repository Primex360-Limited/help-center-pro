import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { bindTenantToUser } from "../tenants/tenant.middleware.js";
import { requireWorkspaceTenant } from "../tenants/require-workspace-tenant.js";
import { requirePermission } from "../roles/rbac.middleware.js";
import {
    getCustomerProfileHandler,
    listCustomersHandler
} from "./customer.controller.js";

const customerRoutes = express.Router();

customerRoutes.get(
    "/customers",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("ticket:read"),
    asyncHandler(listCustomersHandler)
);

customerRoutes.get(
    "/customers/:customerKey",
    requireAuth,
    bindTenantToUser,
    requireWorkspaceTenant,
    requirePermission("ticket:read"),
    asyncHandler(getCustomerProfileHandler)
);

export default customerRoutes;
