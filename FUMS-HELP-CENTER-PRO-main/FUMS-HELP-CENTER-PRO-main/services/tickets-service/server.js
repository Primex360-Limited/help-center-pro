import { createServiceApp } from "../../src/platform/createServiceApp.js";
import { startService } from "../../src/platform/startService.js";
import { SERVICE_NAMES } from "../../src/platform/serviceRegistry.js";
import ticketRoutes from "../../src/modules/tickets/ticket.routes.js";
import supportEmailRoutes from "../../src/modules/tickets/email/support-email.routes.js";
import { healthCheck } from "../../src/modules/health/health.controller.js";
import {
    closeTicketRealtime,
    initializeTicketRealtime
} from "../../src/modules/tickets/realtime/ticket-socket.service.js";

const PORT = Number(process.env.PORT) || 4013;

await startService({
    name: SERVICE_NAMES.TICKETS,
    port: PORT,
    useRedis: true,
    async onListening(httpServer) {
        initializeTicketRealtime(httpServer);
        console.log(`[${SERVICE_NAMES.TICKETS}] realtime socket attached`);
    },
    async onShutdown() {
        await closeTicketRealtime();
    },
    createApp() {
        return createServiceApp({
            serviceName: SERVICE_NAMES.TICKETS,
            healthHandler: healthCheck,
            mountRoutes(app) {
                app.use("/api/v1", supportEmailRoutes);
                app.use("/api/v1", ticketRoutes);
            }
        });
    }
});
