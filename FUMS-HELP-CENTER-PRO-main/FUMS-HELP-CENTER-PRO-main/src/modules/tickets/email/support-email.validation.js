import { z } from "zod";

const addressListSchema = z.union([
    z.string().trim().min(1),
    z.array(z.string().trim().email()).min(1)
]);

export const emailReplySchema = z.object({
    toEmail: z.string().email().optional(),
    subject: z.string().min(1).optional(),
    body: z.string().min(1, "Email body is required"),
    html: z.string().min(1).optional(),
    cc: addressListSchema.optional(),
    bcc: addressListSchema.optional(),
    inReplyTo: z.string().min(1).optional(),
    references: z.string().min(1).optional(),
    /** Preferred connected mailbox to send from */
    emailAccountId: z.string().trim().min(1).optional()
});
