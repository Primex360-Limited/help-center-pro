import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import roleRoutes from "./modules/roles/role.routes.js";
import invitationRoutes from "./modules/invitations/invitation.routes.js";
import supportEmailRoutes from "./modules/tickets/email/support-email.routes.js";
import voiceRoutes from "./modules/tickets/voice/voice.routes.js";
import ticketRoutes from "./modules/tickets/ticket.routes.js";
import tenantRoutes from "./modules/tenants/tenant.routes.js";
import workspaceRoutes from "./modules/workspace/workspace.routes.js";
import platformContentRoutes from "./modules/platform/platform-content.routes.js";
import adminOpsRoutes from "./modules/platform/admin-ops.routes.js";
import emailAccountRoutes from "./modules/email/email-account.routes.js";
import customerRoutes from "./modules/customers/customer.routes.js";
import templateRoutes from "./modules/templates/template.routes.js";
import automationRoutes from "./modules/automations/automation.routes.js";
import widgetPublicRoutes from "./modules/public/widget/widget.routes.js";
import healthRoutes from "./modules/health/health.routes.js";
import {
    healthCheck,
    liveCheck
} from "./modules/health/health.controller.js";
import { createServiceApp } from "./platform/createServiceApp.js";
import { SERVICE_NAMES } from "./platform/serviceRegistry.js";
import asyncHandler from "./middleware/async.middleware.js";

/**
 * Monolith composition — one process owns every /api/v1 route.
 */
const app = createServiceApp({
    serviceName: SERVICE_NAMES.MONOLITH,
    enableDocs: true,
    healthHandler: healthCheck,
    mountRoutes(expressApp) {
        expressApp.get("/health/live", asyncHandler(liveCheck));
        expressApp.use("/api/v1", healthRoutes);
        expressApp.use("/api/v1/auth", authRoutes);
        expressApp.use("/api/v1", userRoutes);
        expressApp.use("/api/v1", roleRoutes);
        expressApp.use("/api/v1", invitationRoutes);
        expressApp.use("/api/v1", tenantRoutes);
        expressApp.use("/api/v1", platformContentRoutes);
        expressApp.use("/api/v1", adminOpsRoutes);
        expressApp.use("/api/v1", workspaceRoutes);
        expressApp.use("/api/v1", widgetPublicRoutes);
        expressApp.use("/api/v1", emailAccountRoutes);
        expressApp.use("/api/v1", customerRoutes);
        expressApp.use("/api/v1", templateRoutes);
        expressApp.use("/api/v1", automationRoutes);
        expressApp.use("/api/v1", supportEmailRoutes);
        expressApp.use("/api/v1", voiceRoutes);
        expressApp.use("/api/v1", ticketRoutes);
    }
});

export default app;
