import rateLimit from "express-rate-limit";

function isHealthPath(req) {
    const path = req.path || "";
    return (
        path === "/health" ||
        path.startsWith("/health/") ||
        path === "/api/v1/health" ||
        path.startsWith("/api/v1/health/") ||
        path === "/api-docs" ||
        path.startsWith("/api-docs") ||
        path === "/api-docs.json"
    );
}

/** Signed-in agents / workspace traffic — never throttle normal product use. */
function isAuthenticatedRequest(req) {
    const auth = String(req.headers?.authorization || "");
    if (/^Bearer\s+\S+/i.test(auth)) return true;
    if (req.cookies?.accessToken || req.cookies?.refreshToken) return true;
    return false;
}

/**
 * Global API limiter — only applies to anonymous / public traffic.
 * Authenticated workspace agents are skipped so Settings, Live Chat polling,
 * tickets, and email never hit "Too many requests".
 */
const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests, please try again later"
    },
    skip: (req) => isHealthPath(req) || isAuthenticatedRequest(req)
});

/** Strict limiter for login / register / password / Google. */
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 80,
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
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please wait a moment and try again."
    }
});

export default rateLimiter;
