import { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";

const globalForPrisma = globalThis;

const prisma = globalForPrisma.__prismaClient || new PrismaClient({
    log: env.NODE_ENV === "production" 
    ? ["warn", "error"] 
    : ["query", "info", "warn", "error"],
});

if(env.NODE_ENV !== "production"){
    globalForPrisma.__prismaClient = prisma;
}

export default prisma;