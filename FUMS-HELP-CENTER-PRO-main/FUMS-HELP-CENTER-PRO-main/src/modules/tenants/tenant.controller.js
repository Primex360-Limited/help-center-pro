import successResponse from "../../shared/utils/apiResponse.js";
import {
    activateTenant,
    deleteTenant,
    getPlatformOverview,
    getTenantById,
    inviteTenantWorkspace,
    listTenants,
    suspendTenant,
    tenantsToCsv
} from "./tenant.service.js";

export async function getPlatformOverviewHandler(req, res) {
    const overview = await getPlatformOverview();
    return successResponse(res, "Platform overview fetched", { overview });
}

export async function listTenantsHandler(req, res) {
    const tenants = await listTenants(req.validatedQuery || {});
    return successResponse(res, "Tenants fetched", { tenants });
}

export async function getTenantHandler(req, res) {
    const tenant = await getTenantById(req.params.id);
    return successResponse(res, "Tenant fetched", { tenant });
}

export async function inviteTenantHandler(req, res) {
    const result = await inviteTenantWorkspace(req.validatedBody, req.user.sub);
    return successResponse(res, "Tenant invitation sent successfully", result, 201);
}

export async function suspendTenantHandler(req, res) {
    const tenant = await suspendTenant(
        req.params.id,
        req.validatedBody || {},
        req.user.sub
    );
    return successResponse(res, "Tenant deactivated", { tenant });
}

export async function activateTenantHandler(req, res) {
    const tenant = await activateTenant(req.params.id, req.user.sub);
    return successResponse(res, "Tenant activated", { tenant });
}

export async function deleteTenantHandler(req, res) {
    const result = await deleteTenant(req.params.id, req.user.sub);
    return successResponse(res, "Tenant deleted", result);
}

export async function exportTenantsCsvHandler(req, res) {
    const tenants = await listTenants(req.validatedQuery || {});
    const csv = tenantsToCsv(tenants);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="helpcentre-pro-tenants-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.status(200).send(csv);
}
