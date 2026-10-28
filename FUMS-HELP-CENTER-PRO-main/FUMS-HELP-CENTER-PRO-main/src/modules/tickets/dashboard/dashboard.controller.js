import successResponse from "../../../shared/utils/apiResponse.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { getDashboardOverview } from "./dashboard.service.js";
import { requireTenantId } from "../helpers/tenant-scope.js";

export async function getDashboardOverviewHandler(req, res) {
    const tenantId = requireTenantId({ req });
    try {
        const overview = await getDashboardOverview(tenantId);
        return successResponse(
            res,
            "Dashboard overview fetched successfully",
            overview
        );
    } catch (err) {
        if (err instanceof AppError) throw err;
        console.error("[dashboard] overview failed:", err?.message || err);
        throw new AppError(
            err?.message || "Unable to load dashboard overview",
            500
        );
    }
}
