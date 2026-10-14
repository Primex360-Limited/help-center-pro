import { env } from "../config/env.js";
import { AppError } from "../shared/errors/AppError.js";

/**
 * Guards internal-only endpoints (notification service, etc.).
 * Skips enforcement when INTERNAL_SERVICE_KEY is unset (local monolith).
 */
export function requireInternalKey(req, _res, next) {
    if (!env.INTERNAL_SERVICE_KEY) {
        return next();
    }

    const provided = req.headers["x-internal-service-key"];
    if (!provided || provided !== env.INTERNAL_SERVICE_KEY) {
        return next(new AppError("Forbidden: invalid internal service key", 403));
    }

    return next();
}
