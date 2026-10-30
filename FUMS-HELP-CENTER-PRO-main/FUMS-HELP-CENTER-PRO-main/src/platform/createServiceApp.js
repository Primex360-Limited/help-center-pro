import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

import errorHandler from "../middleware/error.middleware.js";
import rateLimiter from "../middleware/rateLimiter.middleware.js";
import { isAllowedCorsOrigin } from "../config/corsConfig.js";
import { env } from "../config/env.js";
import swaggerSpec from "../config/swagger.js";
import { buildPublicSwaggerSpec } from "../config/swaggerPublic.js";
import { attachTenantContext } from "../modules/tenants/tenant.middleware.js";
import asyncHandler from "../middleware/async.middleware.js";
import { AppError } from "../shared/errors/AppError.js";
import { extractAccessToken } from "../modules/middleware/auth.middleware.js";
import { verifyAccessToken } from "../modules/auth/auth.utils.js";
import { isSuperAdminRoleName, TENANT_ROLE } from "../shared/constants/roles.js";
import prisma from "../database/prisma/client.js";
import { toUuidOrNull } from "../shared/utils/auditLogger.js";

/**
 * Shared Express bootstrap for every microservice and the monolith.
 * Keeps CORS, tenant context, security headers, and error shape identical
 * so the gateway can proxy without response-format drift.
 */
export function createServiceApp({
    serviceName,
    mountRoutes,
    enableDocs = false,
    enableRateLimit = true,
    enableTenantContext = true,
    healthHandler
} = {}) {
    const app = express();

    app.disable("x-powered-by");
    // Render / reverse proxies: use real client IP for rate limiting.
    app.set("trust proxy", 1);
    app.set("serviceName", serviceName || "help-centre-pro");

    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" }
        })
    );
    app.use(express.json({ limit: "100kb" }));
    // Twilio / form webhooks post as application/x-www-form-urlencoded
    app.use(express.urlencoded({ extended: false, limit: "100kb" }));
    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

    const corsOrigin = {
        origin(origin, callback) {
            if (isAllowedCorsOrigin(origin)) {
                return callback(null, true);
            }

            console.warn(`🚫 Cors blocked (${serviceName}): ${origin}`);
            // Reflect denial without throwing — a thrown Error becomes HTTP 500
            // and the browser surfaces a generic "Unable to reach the API".
            return callback(null, false);
        },
        credentials: true,
        optionsSuccessStatus: 200
    };

    app.use(cors(corsOrigin));
    app.options(/.*/, cors(corsOrigin));
    app.use(cookieParser());

    if (enableTenantContext) {
        app.use(attachTenantContext);
    }

    if (typeof healthHandler === "function") {
        app.get("/health", asyncHandler(healthHandler));
    } else {
        app.get("/health", (_req, res) => {
            res.json({
                success: true,
                service: serviceName,
                status: "ok",
                timestamp: new Date().toISOString()
            });
        });
    }

    if (enableRateLimit) {
        app.use(rateLimiter);
    }

    if (typeof mountRoutes === "function") {
        mountRoutes(app);
    }

    if (enableDocs) {
        const publicSpec = buildPublicSwaggerSpec(swaggerSpec);

        /**
         * Full internal OpenAPI — locked behind workspace admin JWT or
         * `X-Docs-Key` matching SWAGGER_INTERNAL_KEY.
         * Registered BEFORE `/api-docs` so the public mount cannot shadow it.
         */
        async function requireInternalDocsAccess(req, _res, next) {
            try {
                const docsKey = String(
                    req.headers["x-docs-key"] ||
                        req.headers["x-swagger-key"] ||
                        ""
                ).trim();
                if (
                    env.SWAGGER_INTERNAL_KEY &&
                    docsKey &&
                    docsKey === env.SWAGGER_INTERNAL_KEY
                ) {
                    return next();
                }

                const token = extractAccessToken(req);
                if (!token) {
                    throw new AppError(
                        "Internal API docs require an admin session or X-Docs-Key",
                        401
                    );
                }

                const decoded = verifyAccessToken(token);
                const userId = toUuidOrNull(decoded.sub || decoded.user_id);
                if (!userId) {
                    throw new AppError("Invalid session for internal docs", 401);
                }

                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    include: { role: true }
                });
                const roleName = user?.role?.name || "";
                const allowed =
                    isSuperAdminRoleName(roleName) ||
                    roleName === TENANT_ROLE.ADMIN;
                if (!allowed) {
                    throw new AppError(
                        "Only workspace administrators can open internal API docs",
                        403
                    );
                }
                return next();
            } catch (error) {
                return next(
                    error instanceof AppError
                        ? error
                        : new AppError("Internal API docs access denied", 401)
                );
            }
        }

        app.get(
            "/api-docs/internal.json",
            asyncHandler(requireInternalDocsAccess),
            (_req, res) => {
                res.json(swaggerSpec);
            }
        );

        app.use(
            "/api-docs/internal",
            asyncHandler(requireInternalDocsAccess),
            swaggerUi.serveFiles(swaggerSpec, {
                swaggerUrl: "/api-docs/internal.json"
            }),
            swaggerUi.setup(swaggerSpec, {
                customSiteTitle: "Help Centre Pro — Internal API (restricted)",
                swaggerOptions: {
                    withCredentials: true,
                    persistAuthorization: true,
                    displayRequestDuration: true,
                    url: "/api-docs/internal.json"
                }
            })
        );

        /** Public integrator surface — Public Widget + Health only. */
        app.use(
            "/api-docs",
            swaggerUi.serveFiles(publicSpec),
            swaggerUi.setup(publicSpec, {
                customSiteTitle: "Help Centre Pro — Public Integration API",
                swaggerOptions: {
                    persistAuthorization: true,
                    displayRequestDuration: true
                }
            })
        );

        app.get("/api-docs.json", (_req, res) => {
            res.json(publicSpec);
        });
    }

    app.use(errorHandler);
    return app;
}
