import prisma from "../database/prisma/client.js";
import logger from "./logger.js";

export async function connectPostgres() {
    await prisma.$connect();
    logger.info({ module: "postgres" }, "PostgreSQL database connected successfully");
}

export async function disconnectPostgres() {
    await prisma.$disconnect();
    logger.info({ module: "postgres" }, "PostgreSQL database disconnected successfully");
}

export default connectPostgres;