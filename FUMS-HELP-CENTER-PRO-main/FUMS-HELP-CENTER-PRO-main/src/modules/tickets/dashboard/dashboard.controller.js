import successResponse from "../../../shared/utils/apiResponse.js";
import { getDashboardOverview } from "./dashboard.service.js";

export async function getDashboardOverviewHandler(req, res) {
    const overview = await getDashboardOverview();
    return successResponse(res, "Dashboard overview fetched successfully", overview);
}
