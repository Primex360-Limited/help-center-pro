import connectDB, { disconnectDB } from "../config/db.js";
import connectPostgres, { disconnectPostgres } from "../config/postgres.js";
import { connectRedis, disconnectRedis } from "../config/redis.js";
import { assertCriticalEnv, env } from "../config/env.js";

/**
 * Shared process lifecycle for every microservice entrypoint.
 * Bind HTTP first on 0.0.0.0 + process.env.PORT so Render's port scan
 * succeeds even when DB/Redis startup is slow.
 */
export async function startService({
    name,
    port,
    createApp,
    seed,
    useRedis = false,
    useMongo = false,
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

        const app = await createApp();
        const listenPort = Number(port) || Number(process.env.PORT) || env.PORT || 4008;
        const host = process.env.HOST || "0.0.0.0";

        httpServer = await new Promise((resolve, reject) => {
            const server = app.listen(listenPort, host, () => {
                console.log(`[${name}] listening on http://${host}:${listenPort}`);
                console.log(`[${name}] health: http://${host}:${listenPort}/health`);
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

        if (typeof onListening === "function") {
            await onListening(httpServer, app);
        }

        // Keep the API up when background IMAP/mail sockets drop unexpectedly.
        const isTransientMailSocketError = (err) => {
            const code = err?.code || "";
            const msg = String(err?.message || err || "");
            return (
                code === "ECONNRESET" ||
                code === "EPIPE" ||
                code === "ETIMEDOUT" ||
                code === "ECONNREFUSED" ||
                /imap|imapflow|tls/i.test(msg)
            );
        };

        process.on("uncaughtException", (err) => {
            if (isTransientMailSocketError(err)) {
                console.error(`[${name}] transient socket error (kept alive):`, err.message);
                return;
            }
            console.error(`[${name}] uncaughtException:`, err);
            void shutdown("uncaughtException");
        });

        process.on("unhandledRejection", (reason) => {
            if (isTransientMailSocketError(reason)) {
                console.error(
                    `[${name}] transient rejection (kept alive):`,
                    reason?.message || reason
                );
                return;
            }
            console.error(`[${name}] unhandledRejection:`, reason);
        });

        return httpServer;
    } catch (error) {
        console.error(`[${name}] startup failed:`, error.message);
        await closeResources();
        process.exit(1);
    }
}
