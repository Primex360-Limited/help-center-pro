import successResponse from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
    createAutomationRule,
    deleteAutomationRule,
    getAutomationRule,
    listAutomationRules,
    updateAutomationRule
} from "./automation.service.js";

/**
 * Rules are strictly workspace-scoped, so we refuse to touch the shared
 * "no tenant" bucket — a missing workspace would otherwise mix tenants.
 */
function tenantIdOf(req) {
    const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;

    if (!tenantId) {
        throw new AppError(
            "Automation rules are only available inside a workspace",
            400
        );
    }

    return tenantId;
}

export async function listAutomationRulesHandler(req, res) {
    const result = await listAutomationRules(tenantIdOf(req));
    return successResponse(res, "Automation rules fetched successfully", result);
}

export async function getAutomationRuleHandler(req, res) {
    const result = await getAutomationRule(
        tenantIdOf(req),
        req.validatedParams.ruleId
    );
    return successResponse(res, "Automation rule fetched successfully", result);
}

export async function createAutomationRuleHandler(req, res) {
    const result = await createAutomationRule(
        tenantIdOf(req),
        req.currentUser?.id || req.user?.sub,
        req.validatedBody
    );
    return successResponse(res, "Automation rule created successfully", result, 201);
}

export async function updateAutomationRuleHandler(req, res) {
    const result = await updateAutomationRule(
        tenantIdOf(req),
        req.validatedParams.ruleId,
        req.validatedBody
    );
    return successResponse(res, "Automation rule updated successfully", result);
}

export async function deleteAutomationRuleHandler(req, res) {
    const result = await deleteAutomationRule(
        tenantIdOf(req),
        req.validatedParams.ruleId
    );
    return successResponse(res, "Automation rule deleted successfully", result);
}
