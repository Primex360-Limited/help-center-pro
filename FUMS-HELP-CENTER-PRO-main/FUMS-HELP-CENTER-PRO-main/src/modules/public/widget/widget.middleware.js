import { AppError } from "../../../shared/errors/AppError.js";
import { resolveTenantByApiKey } from "../../workspace/api-keys.service.js";

function extractApiKey(req) {
    const headerKey = req.headers["x-hcp-api-key"];
    if (headerKey) return String(headerKey).trim();

    const authorization = req.headers.authorization;
    if (authorization?.startsWith("Bearer ")) {
        return authorization.slice(7).trim();
    }
    return null;
}

/**
 * Authenticate unauthenticated widget requests via API key header.
 * Sets req.widgetTenant, req.widgetMode, req.widgetSettings.
 */
export async function requireWidgetApiKey(req, _res, next) {
    try {
        const rawKey = extractApiKey(req);
        if (!rawKey) {
            throw new AppError(
                "API key required via X-HCP-API-Key or Authorization: Bearer",
                401
            );
        }

        const { tenant, mode, settings, keyKind } = await resolveTenantByApiKey(rawKey);
        if (tenant.status === "suspended") {
            throw new AppError("This workspace has been suspended", 403);
        }

        req.widgetTenant = tenant;
        req.widgetMode = mode;
        req.widgetSettings = settings;
        req.widgetKeyKind = keyKind || "public";
        req.tenantId = tenant.id;
        next();
    } catch (error) {
        next(error);
    }
}

export default requireWidgetApiKey;
