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

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts. Please try again later."
    }
});

export default rateLimiter;
