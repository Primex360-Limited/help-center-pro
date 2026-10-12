import mongoose from "mongoose";
import prisma from "../../database/prisma/client.js";
import { env } from "../../config/env.js";
import { getRedisClient } from "../../config/redis.js";

function serviceResult(name, status, details = {}) {
    return {
        name,
        status,
        ...details
    };
}

async function checkMongo() {
    if (!env.FLEXIBLE_USER_MANAGEMENT && !env.MONGODB_REQUIRED) {
        return serviceResult("mongodb", "skipped", {
            required: false,
            message: "FLEXIBLE_USER_MANAGEMENT not configured"
        });
    }

    const state = mongoose.connection.readyState;
    if (state === 1) {
        await mongoose.connection.db.admin().ping();
        return serviceResult("mongodb", "up", {
            required: env.MONGODB_REQUIRED,
            database: mongoose.connection.name || null
        });
    }

    // Postgres/Prisma is the identity store, so an unreachable legacy Mongo
    // instance only degrades health when MONGODB_REQUIRED=true.
    return serviceResult("mongodb", env.MONGODB_REQUIRED ? "down" : "skipped", {
        required: env.MONGODB_REQUIRED,
        readyState: state
    });
}

async function checkPostgres() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return serviceResult("postgresql", "up", {
            required: env.POSTGRES_REQUIRED
        });
    } catch (error) {
        return serviceResult("postgresql", "down", {
            required: env.POSTGRES_REQUIRED,
            message: env.NODE_ENV === "production" ? "unreachable" : error.message
        });
    }
}

async function checkRedis() {
    if (!env.REDIS_URL) {
        return serviceResult("redis", "skipped", {
            required: env.REDIS_REQUIRED,
            message: "REDIS_URL not configured"
        });
    }

    try {
        const client = getRedisClient();
        const pong = await client.ping();
        return serviceResult("redis", pong === "PONG" ? "up" : "degraded", {
            required: env.REDIS_REQUIRED
        });
    } catch (error) {
        return serviceResult("redis", env.REDIS_REQUIRED ? "down" : "degraded", {
            required: env.REDIS_REQUIRED,
            message: env.NODE_ENV === "production" ? "unreachable" : error.message
        });
    }
}

function checkEmailConfig() {
    const hasKey = Boolean(env.RESEND_API_KEY) && !env.RESEND_API_KEY.includes("placeholder");
    const hasFrom = Boolean(env.EMAIL_FROM);

    if (hasKey && hasFrom) {
        return serviceResult("resend_email", "configured", {
            required: false,
            from: env.EMAIL_FROM
        });
    }

    return serviceResult("resend_email", "misconfigured", {
        required: false,
        message: "Set a valid RESEND_API_KEY and EMAIL_FROM"
    });
}

export async function getHealthReport() {
    const startedAt = Date.now();
    const [mongodb, postgresql, redis] = await Promise.all([
        checkMongo(),
        checkPostgres(),
        checkRedis()
    ]);
    const email = checkEmailConfig();

    const services = { mongodb, postgresql, redis, email };

    const requiredDown = Object.values(services).some(
        (service) => service.required && service.status === "down"
    );

    const status = requiredDown ? "unhealthy" : "healthy";

    return {
        status,
        service: "help-centre-pro-api",
        version: "1.0.0",
        environment: env.NODE_ENV,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startedAt,
        services
    };
}
