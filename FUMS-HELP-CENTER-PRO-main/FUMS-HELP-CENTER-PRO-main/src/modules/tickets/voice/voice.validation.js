import { z } from "zod";

export const placeOutboundCallSchema = z.object({
    to: z.string().min(5, "Destination phone number is required"),
    ticketId: z.string().min(1).optional(),
    customerName: z.string().min(1).optional(),
    customerEmail: z.string().email().optional(),
    title: z.string().min(1).optional(),
    /** ISO country for bare national numbers, e.g. NG, GH, US, GB. +/00 numbers ignore this. */
    defaultRegion: z
        .string()
        .regex(/^[A-Za-z]{2}$/)
        .transform((v) => v.toUpperCase())
        .optional()
});
