import { z } from "zod";

const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Assigned user identitifier must be a valid MongoDB user id");

export const assignTicketSchema = z.object({
    assignedToUserId: objectIdSchema,
    transferReason: z.string().trim().min(3).optional()
});

export const transferTicketSchema = z.object({
    assignedToUserId: objectIdSchema,
    transferReason: z.string().trim().min(3, "Transfer reason is required")
});
