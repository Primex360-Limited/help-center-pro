import app from "./src/app.js";
import connectDB, { disconnectDB } from "./src/config/db.js";
import connectPostgres, { disconnectPostgres } from "./src/config/postgres.js";
import { connectRedis, disconnectRedis } from "./src/config/redis.js";
import { seedSystemRoles } from "./src/modules/roles/seedSystemRoles.js";
import {
    ensureDefaultSuperAdmin,
    seedTestUser
} from "./src/modules/auth/seedTestUser.js";
import { assertCriticalEnv, env } from "./src/config/env.js";
import {
    closeTicketRealtime,
    initializeTicketRealtime
} from "./src/modules/tickets/realtime/ticket-socket.service.js";

let httpServer;
let shuttingDown = false;

async function closeResources() {
    await Promise.allSettled([
        closeTicketRealtime(),
        disconnectRedis(),
        disconnectPostgres(),
        disconnectDB()
    ]);
}

async function shutdown(signal) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    console.log(`${signal} received. Shutting down gracefully...`);

    try {
        if (httpServer) {
            await new Promise((resolve, reject) => {
                httpServer.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
        }
    } catch (error) {
        console.error("HTTP server shutdown failed:", error.message);
    } finally {
        await closeResources();
        process.exit(0);
    }
}

async function startServer() {
    try {
        assertCriticalEnv();

        await connectDB();
        await connectPostgres();
        await seedSystemRoles();
        console.log("✅ System roles and permission catalog seeded (Postgres)");

        await ensureDefaultSuperAdmin();

        if (env.SEED_TEST_USER && env.NODE_ENV !== "production") {
            await seedTestUser();
        }

        try {
            await connectRedis();
        } catch (error) {
            console.error("Redis startup error:", error.message);

            if (env.REDIS_REQUIRED) {
                throw new Error("Redis is required but could not connect");
            }

            console.warn("Redis unavailable. Continuing without Redis.");
        }

        httpServer = app.listen(env.PORT, () => {
            console.log(`Server running on port ${env.PORT}`);
            console.log(`Health: http://localhost:${env.PORT}/health`);
            console.log(`API docs: http://localhost:${env.PORT}/api-docs`);
        });
        initializeTicketRealtime(httpServer);
    } catch (error) {
        console.error("Server startup failed:", error.message);
        await closeResources();
        process.exit(1);
    }
}

process.once("SIGINT", () => {
    void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
});

startServer();
