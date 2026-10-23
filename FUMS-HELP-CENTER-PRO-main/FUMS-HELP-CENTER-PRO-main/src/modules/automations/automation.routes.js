import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { PERMISSION } from "../../shared/constants/permissions.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { bindTenantToUser } from "../tenants/tenant.middleware.js";
import { requireWorkspaceTenant } from "../tenants/require-workspace-tenant.js";
import { requirePermission } from "../roles/rbac.middleware.js";
import {
    createAutomationRuleHandler,
    deleteAutomationRuleHandler,
    getAutomationRuleHandler,
    listAutomationRulesHandler,
    updateAutomationRuleHandler
} from "./automation.controller.js";
import {
    automationRuleIdParamSchema,
    createAutomationRuleSchema,
    updateAutomationRuleSchema
} from "./automation.validation.js";

/**
 * Automation rules are workspace-wide, so they reuse the ticket supervision
 * permissions: `ticket:transfer` to read, `ticket:assign` to change anything.
 * That keeps existing tenant roles working without a permission migration.
 */
const automationRoutes = express.Router();

automationRoutes.use(requireAuth, bindTenantToUser, requireWorkspaceTenant);

automationRoutes.get(
    "/automations",
    requirePermission(PERMISSION.TICKET_TRANSFER),
    asyncHandler(listAutomationRulesHandler)
);

automationRoutes.get(
    "/automations/:ruleId",
    requirePermission(PERMISSION.TICKET_TRANSFER),
    validate(automationRuleIdParamSchema, "params"),
    asyncHandler(getAutomationRuleHandler)
);

automationRoutes.post(
    "/automations",
    requirePermission(PERMISSION.TICKET_ASSIGN),
    validate(createAutomationRuleSchema),
    asyncHandler(createAutomationRuleHandler)
);

automationRoutes.patch(
    "/automations/:ruleId",
    requirePermission(PERMISSION.TICKET_ASSIGN),
    validate(automationRuleIdParamSchema, "params"),
    validate(updateAutomationRuleSchema),
    asyncHandler(updateAutomationRuleHandler)
);

automationRoutes.delete(
    "/automations/:ruleId",
    requirePermission(PERMISSION.TICKET_ASSIGN),
    validate(automationRuleIdParamSchema, "params"),
    asyncHandler(deleteAutomationRuleHandler)
);

export default automationRoutes;
