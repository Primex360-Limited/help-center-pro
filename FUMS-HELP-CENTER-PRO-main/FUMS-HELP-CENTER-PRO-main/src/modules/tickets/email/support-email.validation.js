import { z } from "zod";

export const emailReplySchema = z.object({
    toEmail: z.string().email().optional(),
    subject: z.string().min(1).optional(),
    body: z.string().min(1, "Email body is required"),
    html: z.string().min(1).optional(),
    inReplyTo: z.string().min(1).optional(),
    references: z.string().min(1).optional()
});
