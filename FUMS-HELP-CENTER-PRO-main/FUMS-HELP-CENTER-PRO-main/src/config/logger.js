import pino from "pino";
import { env } from "./env.js";

const logger = pino({
    level: env.NODE_ENV === "production" ? "info" : "debug",
    base: undefined, // Remove pid and hostname from logs
    timestamp: pino.stdTimeFunctions.isoTime, // Use ISO 8601 timestamps
});

export default logger;