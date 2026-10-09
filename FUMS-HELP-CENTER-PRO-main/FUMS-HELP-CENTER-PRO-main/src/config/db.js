import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB() {
    try {
        await mongoose.connect(env.FLEXIBLE_USER_MANAGEMENT);
        console.log("✅ MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        throw error;
    }
}

export async function disconnectDB() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log("❌ MongoDB disconnected");
    }
}

export default connectDB;
