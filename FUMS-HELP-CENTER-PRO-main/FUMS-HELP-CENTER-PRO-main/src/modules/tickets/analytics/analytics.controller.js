import successResponse from "../../../shared/utils/apiResponse.js";
import { requireTenantId } from "../helpers/tenant-scope.js";
import { getTicketAnalytics } from "./analytics.service.js";

export async function getTicketAnalyticsHandler(req, res) {
    const tenantId = requireTenantId({ req });
    const period = String(req.query.period || "7d").toLowerCase();
    const analytics = await getTicketAnalytics(tenantId, period);
    return successResponse(res, "Analytics fetched successfully", analytics);
}
