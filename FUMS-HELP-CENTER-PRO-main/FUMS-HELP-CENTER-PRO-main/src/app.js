import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import cookieParser from "cookie-parser";

import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import roleRoutes from "./modules/roles/role.routes.js";
import invitationRoutes from "./modules/invitations/invitation.routes.js";
import supportEmailRoutes from "./modules/tickets/email/support-email.routes.js";
import ticketRoutes from "./modules/tickets/ticket.routes.js";
import healthRoutes from "./modules/health/health.routes.js";
import { healthCheck } from "./modules/health/health.controller.js";
import asyncHandler from "./middleware/async.middleware.js";

import errorHandler from "./middleware/error.middleware.js";
import rateLimiter from "./middleware/rateLimiter.middleware.js";
import allowedCors from "./config/corsConfig.js";
import swaggerSpec from "./config/swagger.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({ limit: "100kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const corsOrigin = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedCors.includes(origin)) {
            return callback(null, true);
        }

        console.warn(`🚫 Cors blocked: ${origin}`);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOrigin));
app.options(/.*/, cors(corsOrigin));
app.use(cookieParser());

app.get("/health", asyncHandler(healthCheck));
app.use("/api/v1", healthRoutes);

app.use(rateLimiter);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", userRoutes);
app.use("/api/v1", roleRoutes);
app.use("/api/v1", invitationRoutes);
app.use("/api/v1", supportEmailRoutes);
app.use("/api/v1", ticketRoutes);

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

app.get("/api-docs.json", (req, res) => {
    res.json(swaggerSpec);
});

app.use(errorHandler);

export default app;
