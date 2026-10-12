import { z } from "zod";
import { UUID_PATTERN } from "../../../shared/utils/uuid.js";

/** Ticket assignees are Postgres `uuid` user ids. */
const uuidSchema = z
    .string()
    .regex(UUID_PATTERN, "Invalid identifier");

export const assignTicketSchema = z.object({
    assignedToUserId: uuidSchema,
    transferReason: z.string().trim().min(3).optional()
});

export const transferTicketSchema = z.object({
    assignedToUserId: uuidSchema,
    transferReason: z.string().trim().min(3, "Transfer reason is required")
});
