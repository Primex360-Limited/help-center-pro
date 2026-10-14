import { createServiceApp } from "../../src/platform/createServiceApp.js";
import { startService } from "../../src/platform/startService.js";
import { SERVICE_NAMES } from "../../src/platform/serviceRegistry.js";
import tenantRoutes from "../../src/modules/tenants/tenant.routes.js";
import { healthCheck } from "../../src/modules/health/health.controller.js";

const PORT = Number(process.env.PORT) || 4011;

await startService({
    name: SERVICE_NAMES.TENANT,
    port: PORT,
    useRedis: false,
    createApp() {
        return createServiceApp({
            serviceName: SERVICE_NAMES.TENANT,
            healthHandler: healthCheck,
            mountRoutes(app) {
                app.use("/api/v1", tenantRoutes);
            }
        });
    }
});
