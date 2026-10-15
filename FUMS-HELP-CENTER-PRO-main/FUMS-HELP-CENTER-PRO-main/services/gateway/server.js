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

const COLD_START_TIMEOUT_MS = 90000;

function writeJsonUpstreamError(res, statusCode, serviceName, message) {
    if (!res || res.headersSent || typeof res.writeHead !== "function") {
        return;
    }
    res.writeHead(statusCode, { "content-type": "application/json" });
    res.end(
        JSON.stringify({
            success: false,
            message:
                message ||
                "Upstream service is waking up or unavailable. Please try again in a minute.",
            service: serviceName
        })
    );
}

/**
 * Express strips the mount path from req.url before the proxy runs.
 * Upstream services still expect the full /api/v1/... path, so restore it.
 * Free-tier Render cold starts need long timeouts; HTML 502 pages must not
 * leak through to the SPA.
 */
function proxyTo(
    target,
    { mountPath = "", serviceName, ws = false, timeout = COLD_START_TIMEOUT_MS } = {}
) {
    const useWs = Boolean(ws);
    const handlers = {
        proxyReq(proxyReq, req) {
            proxyReq.setHeader("x-forwarded-path", req.originalUrl || req.url);
            if (!useWs) {
                proxyReq.setHeader("accept", "application/json");
            }
        },
        error(err, _req, res) {
            console.error(`[gateway] proxy error → ${serviceName || target}:`, err.message);
            writeJsonUpstreamError(res, 502, serviceName || target);
        }
    };

    // HTTP only: scrub Render/Express HTML error pages before they hit the SPA.
    // WebSocket upgrades must stream as-is (selfHandleResponse breaks them).
    if (!useWs) {
        handlers.proxyRes = (proxyRes, _req, res) => {
            const chunks = [];
            proxyRes.on("data", (chunk) => chunks.push(chunk));
            proxyRes.on("end", () => {
                const buffer = Buffer.concat(chunks);
                const status = proxyRes.statusCode || 502;
                const contentType = String(
                    proxyRes.headers["content-type"] || ""
                ).toLowerCase();
                const bodyText = buffer.toString("utf8");
                const looksLikeHtml =
                    contentType.includes("text/html") ||
                    /<\s*!?\s*doctype|<\s*html|@font-face|Bad Gateway/i.test(bodyText);

                if (looksLikeHtml && status >= 400) {
                    console.error(
                        `[gateway] replaced HTML ${status} from ${serviceName || target}`
                    );
                    writeJsonUpstreamError(
                        res,
                        status === 502 || status === 503 || status === 504
                            ? status
                            : 502,
                        serviceName || target,
                        "Upstream service is waking up or unavailable. Please try again in a minute."
                    );
                    return;
                }

                const headers = { ...proxyRes.headers };
                delete headers["transfer-encoding"];
                delete headers["content-length"];
                res.writeHead(status, headers);
                res.end(buffer);
            });
        };
    }

    return createProxyMiddleware({
        target,
        changeOrigin: true,
        xfwd: true,
        ws: useWs,
        proxyTimeout: timeout,
        timeout,
        pathRewrite(path) {
            if (!mountPath) {
                return path;
            }
            // path is e.g. "/login" or "/login?x=1" after Express mount strip
            return `${mountPath}${path.startsWith("/") ? path : `/${path}`}`;
        },
        selfHandleResponse: !useWs,
        on: handlers
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

app.get("/health/live", (_req, res) => {
    res.json({
        success: true,
        service: SERVICE_NAMES.GATEWAY,
        status: "live",
        timestamp: new Date().toISOString()
    });
});

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

    res.json({
        success: allOk,
        service: SERVICE_NAMES.GATEWAY,
        status: allOk ? "ok" : "degraded",
        services,
        timestamp: new Date().toISOString()
    });
});

app.use(rateLimiter);

app.use(
    "/api/v1/auth",
    proxyTo(urls.auth, {
        mountPath: "/api/v1/auth",
        serviceName: "auth-service",
        timeout: COLD_START_TIMEOUT_MS
    })
);
app.use(
    "/api/v1/admin",
    proxyTo(urls.tenant, { mountPath: "/api/v1/admin", serviceName: "tenant-service" })
);
app.use(
    "/api/v1/users",
    proxyTo(urls.identity, { mountPath: "/api/v1/users", serviceName: "identity-service" })
);
app.use(
    "/api/v1/roles",
    proxyTo(urls.identity, { mountPath: "/api/v1/roles", serviceName: "identity-service" })
);
app.use(
    "/api/v1/invitations",
    proxyTo(urls.identity, {
        mountPath: "/api/v1/invitations",
        serviceName: "identity-service"
    })
);
app.use(
    "/api/v1/tickets",
    proxyTo(urls.tickets, {
        mountPath: "/api/v1/tickets",
        serviceName: "tickets-service",
        ws: true,
        timeout: 60000
    })
);
app.use(
    "/socket.io",
    proxyTo(urls.tickets, {
        mountPath: "/socket.io",
        serviceName: "tickets-service",
        ws: true,
        timeout: 60000
    })
);
app.use(
    "/api/v1/health",
    proxyTo(urls.auth, { mountPath: "/api/v1/health", serviceName: "auth-service" })
);

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
    console.log(
        `[gateway] routing → auth:${urls.auth} tenant:${urls.tenant} identity:${urls.identity} tickets:${urls.tickets} notify:${urls.notification}`
    );
    console.log(`[gateway] health: http://localhost:${PORT}/health`);
    console.log(`[gateway] docs: http://localhost:${PORT}/api-docs`);
});

process.once("SIGINT", () => {
    httpServer.close(() => process.exit(0));
});
process.once("SIGTERM", () => {
    httpServer.close(() => process.exit(0));
});
