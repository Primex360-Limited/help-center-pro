import rateLimit from "express-rate-limit";

const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests, please try again later"
    },
    skip: (req) => {
        const path = req.path || "";
        return (
            path === "/health" ||
            path.startsWith("/health/") ||
            path === "/api/v1/health" ||
            path.startsWith("/api/v1/health/")
        );
    }
});

/** Strict limiter for login / register / password / Google. */
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts. Please try again later."
    }
});

/**
 * Soft limiter for signup helpers (verification polling + company details).
 * Must stay well above check-email poll frequency so onboarding never blocks.
 */
export const authFlowRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please wait a moment and try again."
    }
});

export default rateLimiter;
