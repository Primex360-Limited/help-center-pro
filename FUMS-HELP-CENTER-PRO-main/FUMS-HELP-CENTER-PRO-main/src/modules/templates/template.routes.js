import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { bindTenantToUser } from "../tenants/tenant.middleware.js";
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

templateRoutes.get(
    "/templates",
    requireAuth,
    bindTenantToUser,
    requirePermission("template:read"),
    asyncHandler(listTemplatesHandler)
);

templateRoutes.post(
    "/templates",
    requireAuth,
    bindTenantToUser,
    requirePermission("template:create"),
    validate(createTemplateSchema),
    asyncHandler(createTemplateHandler)
);

templateRoutes.patch(
    "/templates/:templateId",
    requireAuth,
    bindTenantToUser,
    requirePermission("template:update"),
    validate(templateIdParamSchema, "params"),
    validate(updateTemplateSchema),
    asyncHandler(updateTemplateHandler)
);

templateRoutes.delete(
    "/templates/:templateId",
    requireAuth,
    bindTenantToUser,
    requirePermission("template:delete"),
    validate(templateIdParamSchema, "params"),
    asyncHandler(deleteTemplateHandler)
);

export default templateRoutes;
