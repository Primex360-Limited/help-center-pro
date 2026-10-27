import { z } from "zod";

export const widgetVisitorSchema = z.object({
    email: z.string().trim().email("A valid email is required"),
    phone: z
        .union([z.literal(""), z.string().trim().min(5).max(32)])
        .optional()
        .transform((v) => (v ? v : undefined)),
    name: z
        .union([z.literal(""), z.string().trim().min(1).max(120)])
        .optional()
        .transform((v) => (v ? v : undefined)),
    message: z
        .union([z.literal(""), z.string().trim().min(1).max(5000)])
        .optional()
        .transform((v) => (v ? v : undefined))
});

export const widgetMessageSchema = z.object({
    ticketId: z.string().trim().min(1, "ticketId is required"),
    message: z.string().trim().min(1, "message is required").max(5000),
    email: z.string().trim().email().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().min(5).max(32).optional()
});
