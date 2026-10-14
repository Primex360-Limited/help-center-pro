import connectDB, { disconnectDB } from "../config/db.js";
import connectPostgres, { disconnectPostgres } from "../config/postgres.js";
import { connectRedis, disconnectRedis } from "../config/redis.js";
import { assertCriticalEnv, env } from "../config/env.js";

/**
 * Shared process lifecycle for every microservice entrypoint.
 */
export async function startService({
    name,
    port,
    createApp,
    seed,
    useRedis = false,
    useMongo = true,
    usePostgres = true,
    requireCriticalEnv = true,
    onListening,
    onShutdown
} = {}) {
    let httpServer;
    let shuttingDown = false;

    async function closeResources() {
        await Promise.allSettled([
            typeof onShutdown === "function" ? onShutdown() : Promise.resolve(),
            disconnectRedis(),
            disconnectPostgres(),
            disconnectDB()
        ]);
    }

    async function shutdown(signal) {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[${name}] ${signal} received. Shutting down gracefully...`);

        try {
            if (httpServer) {
                await new Promise((resolve, reject) => {
                    httpServer.close((error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
            }
        } catch (error) {
            console.error(`[${name}] HTTP shutdown failed:`, error.message);
        } finally {
            await closeResources();
            process.exit(0);
        }
    }

    try {
        if (requireCriticalEnv) {
            assertCriticalEnv();
        }

        if (useMongo) {
            await connectDB();
        }

        if (usePostgres) {
            await connectPostgres();
        }

        if (typeof seed === "function") {
            await seed();
        }

        if (useRedis) {
            try {
                await connectRedis();
            } catch (error) {
                console.error(`[${name}] Redis startup error:`, error.message);
                if (env.REDIS_REQUIRED) {
                    throw new Error("Redis is required but could not connect");
                }
                console.warn(`[${name}] Redis unavailable. Continuing without Redis.`);
            }
        }

        const app = await createApp();
        const listenPort = Number(port) || env.PORT;

        httpServer = app.listen(listenPort, () => {
            console.log(`[${name}] listening on :${listenPort}`);
            console.log(`[${name}] health: http://localhost:${listenPort}/health`);
        });

        if (typeof onListening === "function") {
            await onListening(httpServer, app);
        }

        process.once("SIGINT", () => {
            void shutdown("SIGINT");
        });
        process.once("SIGTERM", () => {
            void shutdown("SIGTERM");
        });

        return httpServer;
    } catch (error) {
        console.error(`[${name}] startup failed:`, error.message);
        await closeResources();
        process.exit(1);
    }
}
