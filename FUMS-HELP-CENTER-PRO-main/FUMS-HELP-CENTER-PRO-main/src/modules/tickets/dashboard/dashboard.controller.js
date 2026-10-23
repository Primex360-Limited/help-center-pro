import successResponse from "../../../shared/utils/apiResponse.js";
import { getDashboardOverview } from "./dashboard.service.js";
import { requireTenantId } from "../helpers/tenant-scope.js";

export async function getDashboardOverviewHandler(req, res) {
    const tenantId = requireTenantId({ req });
    const overview = await getDashboardOverview(tenantId);
    return successResponse(res, "Dashboard overview fetched successfully", overview);
}
