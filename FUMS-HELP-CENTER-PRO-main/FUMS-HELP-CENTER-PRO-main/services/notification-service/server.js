import { createServiceApp } from "../../src/platform/createServiceApp.js";
import { startService } from "../../src/platform/startService.js";
import { SERVICE_NAMES } from "../../src/platform/serviceRegistry.js";
import notificationRoutes from "../../src/modules/notifications/notification.routes.js";

const PORT = Number(process.env.PORT) || 4014;

await startService({
    name: SERVICE_NAMES.NOTIFICATION,
    port: PORT,
    useMongo: false,
    usePostgres: false,
    useRedis: false,
    requireCriticalEnv: false,
    createApp() {
        return createServiceApp({
            serviceName: SERVICE_NAMES.NOTIFICATION,
            enableTenantContext: false,
            enableRateLimit: false,
            mountRoutes(app) {
                app.use(notificationRoutes);
            }
        });
    }
});
