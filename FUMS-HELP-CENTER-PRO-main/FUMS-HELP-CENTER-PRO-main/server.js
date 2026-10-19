import app from "./src/app.js";
import connectDB, { disconnectDB } from "./src/config/db.js";
import connectPostgres, { disconnectPostgres } from "./src/config/postgres.js";
import { connectRedis, disconnectRedis } from "./src/config/redis.js";
import { seedSystemRoles } from "./src/modules/roles/seedSystemRoles.js";
import {
    ensureDefaultSuperAdmin,
    seedTestUser
} from "./src/modules/auth/seedTestUser.js";
import { seedDemoTickets } from "./src/modules/tickets/seedDemoTickets.js";
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

        const listenPort = Number(process.env.PORT) || env.PORT || 4008;
        const host = process.env.HOST || "0.0.0.0";

        // Bind first so Render's port scan succeeds while DB/Redis warm up.
        httpServer = await new Promise((resolve, reject) => {
            const server = app.listen(listenPort, host, () => {
                console.log(`Server running on http://${host}:${listenPort}`);
                console.log(`Health: http://${host}:${listenPort}/health`);
                console.log(`API docs: http://${host}:${listenPort}/api-docs`);
                resolve(server);
            });
            server.on("error", reject);
        });

        process.once("SIGINT", () => {
            void shutdown("SIGINT");
        });
        process.once("SIGTERM", () => {
            void shutdown("SIGTERM");
        });

        await connectDB();
        await connectPostgres();
        await seedSystemRoles();
        console.log("✅ System roles and permission catalog seeded (Postgres)");

        await ensureDefaultSuperAdmin();

        if (env.SEED_TEST_USER && env.NODE_ENV !== "production") {
            await seedTestUser();
            await seedDemoTickets();
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

        initializeTicketRealtime(httpServer);
    } catch (error) {
        console.error("Server startup failed:", error.message);
        await closeResources();
        process.exit(1);
    }
}

startServer();
