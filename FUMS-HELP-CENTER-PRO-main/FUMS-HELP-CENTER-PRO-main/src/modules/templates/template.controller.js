import successResponse from "../../shared/utils/apiResponse.js";
import {
    createTemplate,
    deleteTemplate,
    listTemplates,
    updateTemplate
} from "./template.service.js";

function tenantIdOf(req) {
    return req.tenantId ?? req.currentUser?.tenantId ?? null;
}

export async function listTemplatesHandler(req, res) {
    const result = await listTemplates(tenantIdOf(req));
    return successResponse(res, "Templates fetched successfully", result);
}

export async function createTemplateHandler(req, res) {
    const result = await createTemplate(
        tenantIdOf(req),
        req.currentUser?.id || req.user?.sub,
        req.validatedBody
    );
    return successResponse(res, "Template created successfully", result, 201);
}

export async function updateTemplateHandler(req, res) {
    const result = await updateTemplate(
        tenantIdOf(req),
        req.validatedParams.templateId,
        req.validatedBody
    );
    return successResponse(res, "Template updated successfully", result);
}

export async function deleteTemplateHandler(req, res) {
    const result = await deleteTemplate(tenantIdOf(req), req.validatedParams.templateId);
    return successResponse(res, "Template deleted successfully", result);
}
