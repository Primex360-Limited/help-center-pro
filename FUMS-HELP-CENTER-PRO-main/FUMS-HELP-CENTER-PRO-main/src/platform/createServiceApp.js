import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

import errorHandler from "../middleware/error.middleware.js";
import rateLimiter from "../middleware/rateLimiter.middleware.js";
import allowedCors from "../config/corsConfig.js";
import swaggerSpec from "../config/swagger.js";
import { attachTenantContext } from "../modules/tenants/tenant.middleware.js";
import asyncHandler from "../middleware/async.middleware.js";

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
    app.set("serviceName", serviceName || "help-centre-pro");

    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" }
        })
    );
    app.use(express.json({ limit: "100kb" }));
    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

    const corsOrigin = {
        origin(origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedCors.includes(origin)) {
                return callback(null, true);
            }

            console.warn(`🚫 Cors blocked (${serviceName}): ${origin}`);
            return callback(new Error("Not allowed by CORS"));
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
        app.use(
            "/api-docs",
            swaggerUi.serve,
            swaggerUi.setup(swaggerSpec, {
                customSiteTitle: "Help Centre Pro API Docs",
                swaggerOptions: {
                    withCredentials: true,
                    persistAuthorization: true,
                    displayRequestDuration: true
                }
            })
        );

        app.get("/api-docs.json", (_req, res) => {
            res.json(swaggerSpec);
        });
    }

    app.use(errorHandler);
    return app;
}
