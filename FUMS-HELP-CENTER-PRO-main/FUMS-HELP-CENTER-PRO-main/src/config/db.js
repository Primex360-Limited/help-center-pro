import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * Connects to MongoDB when a URI is configured.
 *
 * Postgres/Prisma owns the identity layer now, so a missing or unreachable
 * Mongo instance is only fatal when MONGODB_REQUIRED=true.
 */
export async function connectDB() {
    if (!env.FLEXIBLE_USER_MANAGEMENT) {
        if (env.MONGODB_REQUIRED) {
            throw new Error("FLEXIBLE_USER_MANAGEMENT is required but not configured");
        }

        console.warn("MongoDB not configured. Continuing with Postgres only.");
        return false;
    }

    try {
        await mongoose.connect(env.FLEXIBLE_USER_MANAGEMENT);
        console.log("✅ MongoDB connected");
        return true;
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);

        if (env.MONGODB_REQUIRED) {
            throw error;
        }

        console.warn("MongoDB unavailable. Continuing with Postgres only.");
        return false;
    }
}

export async function disconnectDB() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log("❌ MongoDB disconnected");
    }
}

export default connectDB;
