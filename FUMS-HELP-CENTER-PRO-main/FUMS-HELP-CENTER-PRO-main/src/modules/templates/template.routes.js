import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { bindTenantToUser } from "../tenants/tenant.middleware.js";
import { requireWorkspaceTenant } from "../tenants/require-workspace-tenant.js";
import { requirePermission } from "../roles/rbac.middleware.js";
import {
    createTemplateHandler,
    deleteTemplateHandler,
    listTemplatesHandler,
    updateTemplateHandler
} from "./template.controller.js";
import {
    createTemplateSchema,
    templateIdParamSchema,
    updateTemplateSchema
} from "./template.validation.js";

const templateRoutes = express.Router();

templateRoutes.use(requireAuth, bindTenantToUser, requireWorkspaceTenant);

templateRoutes.get(
    "/templates",
    requirePermission("template:read"),
    asyncHandler(listTemplatesHandler)
);

templateRoutes.post(
    "/templates",
    requirePermission("template:create"),
    validate(createTemplateSchema),
    asyncHandler(createTemplateHandler)
);

templateRoutes.patch(
    "/templates/:templateId",
    requirePermission("template:update"),
    validate(templateIdParamSchema, "params"),
    validate(updateTemplateSchema),
    asyncHandler(updateTemplateHandler)
);

templateRoutes.delete(
    "/templates/:templateId",
    requirePermission("template:delete"),
    validate(templateIdParamSchema, "params"),
    asyncHandler(deleteTemplateHandler)
);

export default templateRoutes;
