import { createServiceApp } from "../../src/platform/createServiceApp.js";
import { startService } from "../../src/platform/startService.js";
import { SERVICE_NAMES } from "../../src/platform/serviceRegistry.js";
import userRoutes from "../../src/modules/users/user.routes.js";
import roleRoutes from "../../src/modules/roles/role.routes.js";
import invitationRoutes from "../../src/modules/invitations/invitation.routes.js";
import { healthCheck } from "../../src/modules/health/health.controller.js";

const PORT = Number(process.env.PORT) || 4012;

await startService({
    name: SERVICE_NAMES.IDENTITY,
    port: PORT,
    useRedis: true,
    createApp() {
        return createServiceApp({
            serviceName: SERVICE_NAMES.IDENTITY,
            healthHandler: healthCheck,
            mountRoutes(app) {
                app.use("/api/v1", userRoutes);
                app.use("/api/v1", roleRoutes);
                app.use("/api/v1", invitationRoutes);
            }
        });
    }
});
