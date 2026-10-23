import successResponse from "../../shared/utils/apiResponse.js";
import { getCustomerProfile, listCustomers } from "./customer.service.js";
import { requireTenantId } from "../tickets/helpers/tenant-scope.js";

export async function listCustomersHandler(req, res) {
    const tenantId = requireTenantId({ req });
    const result = await listCustomers(tenantId);
    return successResponse(res, "Customers fetched successfully", result);
}

export async function getCustomerProfileHandler(req, res) {
    const tenantId = requireTenantId({ req });
    const result = await getCustomerProfile(req.params.customerKey, tenantId);
    return successResponse(res, "Customer profile fetched successfully", result);
}
