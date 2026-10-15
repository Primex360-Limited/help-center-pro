import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import roleRoutes from "./modules/roles/role.routes.js";
import invitationRoutes from "./modules/invitations/invitation.routes.js";
import supportEmailRoutes from "./modules/tickets/email/support-email.routes.js";
import ticketRoutes from "./modules/tickets/ticket.routes.js";
import tenantRoutes from "./modules/tenants/tenant.routes.js";
import workspaceRoutes from "./modules/workspace/workspace.routes.js";
import healthRoutes from "./modules/health/health.routes.js";
import { healthCheck } from "./modules/health/health.controller.js";
import { createServiceApp } from "./platform/createServiceApp.js";
import { SERVICE_NAMES } from "./platform/serviceRegistry.js";

/**
 * Monolith composition — same route mounts the microservices expose
 * individually. Render / `npm start` keep this entry for a single process.
 */
const app = createServiceApp({
    serviceName: SERVICE_NAMES.MONOLITH,
    enableDocs: true,
    healthHandler: healthCheck,
    mountRoutes(expressApp) {
        expressApp.use("/api/v1", healthRoutes);
        expressApp.use("/api/v1/auth", authRoutes);
        expressApp.use("/api/v1", userRoutes);
        expressApp.use("/api/v1", roleRoutes);
        expressApp.use("/api/v1", invitationRoutes);
        expressApp.use("/api/v1", tenantRoutes);
        expressApp.use("/api/v1", workspaceRoutes);
        expressApp.use("/api/v1", supportEmailRoutes);
        expressApp.use("/api/v1", ticketRoutes);
    }
});

export default app;
