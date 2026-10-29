import { z } from "zod";

const optionalEmail = z
    .union([z.literal(""), z.string().trim().email("Enter a valid email")])
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalPhone = z
    .union([z.literal(""), z.string().trim().min(5).max(32)])
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalName = z
    .union([z.literal(""), z.string().trim().min(1).max(120)])
    .optional()
    .transform((v) => (v ? v : undefined));

/** Name, email, and phone are all optional — anonymous visitors are supported. */
export const widgetVisitorSchema = z.object({
    email: optionalEmail,
    phone: optionalPhone,
    name: optionalName,
    message: z
        .union([z.literal(""), z.string().trim().min(1).max(5000)])
        .optional()
        .transform((v) => (v ? v : undefined))
});

export const widgetMessageSchema = z.object({
    ticketId: z.string().trim().min(1, "ticketId is required"),
    message: z.string().trim().min(1, "message is required").max(5000),
    email: optionalEmail,
    name: optionalName,
    phone: optionalPhone,
    /**
     * Secret-key only. Default is customer (visitor). Pass "agent" when your
     * server posts an automated agent reply into the thread.
     */
    role: z.enum(["customer", "agent"]).optional()
});

/** GET /public/widget/messages?ticketId=TK-…&after=ISO&limit=100 */
export const widgetListMessagesQuerySchema = z.object({
    ticketId: z.string().trim().min(1, "ticketId is required"),
    after: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional()
});
