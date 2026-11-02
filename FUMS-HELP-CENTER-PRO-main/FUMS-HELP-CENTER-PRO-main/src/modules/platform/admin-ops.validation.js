import { z } from "zod";
import { UUID_PATTERN } from "../../shared/utils/uuid.js";

const uuidSchema = z.string().regex(UUID_PATTERN, "Invalid identifier");

export const billingQuerySchema = z.object({
    q: z.string().optional().default(""),
    status: z
        .enum(["all", "paid", "open", "past_due", "refunded", "void"])
        .optional()
        .default("all")
});

export const invoiceParamSchema = z.object({
    invoiceId: z.string().min(3).max(120)
});

export const invoiceStatusSchema = z.object({
    status: z.enum(["paid", "open", "past_due", "refunded", "void"])
});

export const planParamSchema = z.object({
    planKey: z.enum(["trial", "starter", "growth", "scale", "enterprise"])
});

export const updatePlanSchema = z
    .object({
        label: z.string().min(2).max(40).optional(),
        tagline: z.string().max(120).optional(),
        priceNgn: z.number().min(0).max(100_000_000).optional(),
        seatLimit: z.number().int().min(1).max(10_000).optional(),
        extraSeatNgn: z.number().min(0).max(10_000_000).optional(),
        ticketLimit: z.number().int().min(0).max(10_000_000).optional(),
        features: z.array(z.string().min(1).max(80)).max(12).optional(),
        popular: z.boolean().optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "Nothing to update"
    });

export const staffQuerySchema = z.object({
    q: z.string().optional().default("")
});

export const inviteStaffSchema = z.object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    email: z.string().email().max(180),
    role: z.enum(["Owner", "Admin", "Support", "Viewer"]).default("Admin")
});

export const staffIdParamSchema = z.object({
    userId: uuidSchema
});

export const updateStaffSchema = z
    .object({
        status: z.enum(["active", "inactive"]).optional(),
        role: z.enum(["Owner", "Admin", "Support", "Viewer"]).optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "Nothing to update"
    });

export const auditQuerySchema = z.object({
    q: z.string().optional().default(""),
    limit: z.coerce.number().int().min(1).max(300).optional().default(120)
});
