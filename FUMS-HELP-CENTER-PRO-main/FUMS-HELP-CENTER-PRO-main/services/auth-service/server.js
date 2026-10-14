import { createServiceApp } from "../../src/platform/createServiceApp.js";
import { startService } from "../../src/platform/startService.js";
import { SERVICE_NAMES } from "../../src/platform/serviceRegistry.js";
import { env } from "../../src/config/env.js";
import authRoutes from "../../src/modules/auth/auth.routes.js";
import healthRoutes from "../../src/modules/health/health.routes.js";
import { healthCheck } from "../../src/modules/health/health.controller.js";
import asyncHandler from "../../src/middleware/async.middleware.js";
import { seedSystemRoles } from "../../src/modules/roles/seedSystemRoles.js";
import {
    ensureDefaultSuperAdmin,
    seedTestUser
} from "../../src/modules/auth/seedTestUser.js";

const PORT = Number(process.env.PORT) || 4010;

await startService({
    name: SERVICE_NAMES.AUTH,
    port: PORT,
    useRedis: true,
    async seed() {
        await seedSystemRoles();
        console.log(`[${SERVICE_NAMES.AUTH}] system roles seeded`);
        await ensureDefaultSuperAdmin();
        if (env.SEED_TEST_USER && env.NODE_ENV !== "production") {
            await seedTestUser();
        }
    },
    createApp() {
        return createServiceApp({
            serviceName: SERVICE_NAMES.AUTH,
            healthHandler: healthCheck,
            mountRoutes(app) {
                app.get("/health/live", asyncHandler(async (_req, res) => {
                    res.json({ success: true, service: SERVICE_NAMES.AUTH, live: true });
                }));
                app.use("/api/v1", healthRoutes);
                app.use("/api/v1/auth", authRoutes);
            }
        });
    }
});
