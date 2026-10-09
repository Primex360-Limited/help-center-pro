import successResponse from "../../shared/utils/apiResponse.js";
import { getHealthReport } from "./health.service.js";

export async function healthCheck(req, res) {
    const report = await getHealthReport();
    const statusCode = report.status === "healthy" ? 200 : 503;

    return successResponse(
        res,
        report.status === "healthy"
            ? "All required services are healthy"
            : "One or more required services are unhealthy",
        report,
        statusCode
    );
}

export async function liveCheck(_req, res) {
    return successResponse(res, "API is live", {
        status: "live",
        timestamp: new Date().toISOString()
    });
}

export async function readyCheck(req, res) {
    const report = await getHealthReport();
    const ready = report.status === "healthy";

    return successResponse(
        res,
        ready ? "API is ready" : "API is not ready",
        {
            status: ready ? "ready" : "not_ready",
            services: report.services
        },
        ready ? 200 : 503
    );
}
