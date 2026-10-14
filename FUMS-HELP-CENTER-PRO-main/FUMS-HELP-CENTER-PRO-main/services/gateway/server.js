import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { createProxyMiddleware } from "http-proxy-middleware";

import allowedCors from "../../src/config/corsConfig.js";
import swaggerSpec from "../../src/config/swagger.js";
import errorHandler from "../../src/middleware/error.middleware.js";
import rateLimiter from "../../src/middleware/rateLimiter.middleware.js";
import { getServiceUrls, SERVICE_NAMES } from "../../src/platform/serviceRegistry.js";
import { probeServiceHealth } from "../../src/platform/serviceClient.js";

const PORT = Number(process.env.PORT) || 4008;
const urls = getServiceUrls();

function proxyTo(target, options = {}) {
    return createProxyMiddleware({
        target,
        changeOrigin: true,
        xfwd: true,
        ws: Boolean(options.ws),
        proxyTimeout: options.timeout || 30000,
        timeout: options.timeout || 30000,
        on: {
            error(err, _req, res) {
                console.error(`[gateway] proxy error → ${target}:`, err.message);
                if (res && !res.headersSent && typeof res.writeHead === "function") {
                    res.writeHead(502, { "content-type": "application/json" });
                    res.end(
                        JSON.stringify({
                            success: false,
                            message: "Upstream service unavailable",
                            service: options.serviceName || target
                        })
                    );
                }
            }
        }
    });
}

const app = express();
app.disable("x-powered-by");
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    })
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const corsOrigin = {
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedCors.includes(origin)) {
            return callback(null, true);
        }
        console.warn(`🚫 Cors blocked (gateway): ${origin}`);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOrigin));
app.options(/.*/, cors(corsOrigin));
app.use(cookieParser());

app.get("/health", async (_req, res) => {
    const probes = await Promise.all([
        probeServiceHealth(urls.auth).then((r) => ["auth-service", r]),
        probeServiceHealth(urls.tenant).then((r) => ["tenant-service", r]),
        probeServiceHealth(urls.identity).then((r) => ["identity-service", r]),
        probeServiceHealth(urls.tickets).then((r) => ["tickets-service", r]),
        probeServiceHealth(urls.notification).then((r) => ["notification-service", r])
    ]);

    const services = Object.fromEntries(
        probes.map(([name, result]) => [
            name,
            result.ok ? { status: "ok" } : { status: "down", error: result.error }
        ])
    );
    const allOk = probes.every(([, result]) => result.ok);

    res.status(allOk ? 200 : 503).json({
        success: allOk,
        service: SERVICE_NAMES.GATEWAY,
        status: allOk ? "ok" : "degraded",
        services,
        timestamp: new Date().toISOString()
    });
});

app.use(rateLimiter);

// Preserve /api/v1 contract for the frontend — route by domain prefix.
app.use("/api/v1/auth", proxyTo(urls.auth, { serviceName: "auth-service" }));
app.use("/api/v1/admin", proxyTo(urls.tenant, { serviceName: "tenant-service" }));
app.use("/api/v1/users", proxyTo(urls.identity, { serviceName: "identity-service" }));
app.use("/api/v1/roles", proxyTo(urls.identity, { serviceName: "identity-service" }));
app.use("/api/v1/invitations", proxyTo(urls.identity, { serviceName: "identity-service" }));
app.use(
    "/api/v1/tickets",
    proxyTo(urls.tickets, { serviceName: "tickets-service", ws: true, timeout: 60000 })
);
app.use(
    "/socket.io",
    proxyTo(urls.tickets, { serviceName: "tickets-service", ws: true, timeout: 60000 })
);
app.use("/api/v1/health", proxyTo(urls.auth, { serviceName: "auth-service" }));

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

app.use(errorHandler);

const httpServer = app.listen(PORT, () => {
    console.log(`[gateway] public API on :${PORT}`);
    console.log(`[gateway] routing → auth:${urls.auth} tenant:${urls.tenant} identity:${urls.identity} tickets:${urls.tickets} notify:${urls.notification}`);
    console.log(`[gateway] health: http://localhost:${PORT}/health`);
    console.log(`[gateway] docs: http://localhost:${PORT}/api-docs`);
});

// Socket.IO upgrade traffic for tickets realtime
httpServer.on("upgrade", (req, socket, head) => {
    // http-proxy-middleware attaches upgrade handler when ws:true on a mounted path;
    // this is a safety net log for debugging websocket issues.
    if (req.url?.startsWith("/socket.io") || req.url?.includes("tickets")) {
        console.log(`[gateway] ws upgrade: ${req.url}`);
    }
});

process.once("SIGINT", () => {
    httpServer.close(() => process.exit(0));
});
process.once("SIGTERM", () => {
    httpServer.close(() => process.exit(0));
});
