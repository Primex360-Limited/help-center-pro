import { z } from "zod";

export const resendInboundEmailWebhookSchema = z.object({
    type: z.string().min(1),
    created_at: z.string().optional(),
    data: z.object({
        email_id: z.string().min(1).optional(),
        created_at: z.string().optional(),
        from: z.string().min(1).optional(),
        to: z.array(z.string()).optional(),
        bcc: z.array(z.string()).optional(),
        cc: z.array(z.string()).optional(),
        message_id: z.string().optional(),
        subject: z.string().optional(),
        text: z.string().optional(),
        html: z.string().optional(),
        attachments: z.array(z.record(z.string(), z.any())).optional()
    }).passthrough()
}).passthrough();

export const emailReplySchema = z.object({
    toEmail: z.string().email().optional(),
    subject: z.string().min(1).optional(),
    body: z.string().min(1, "Email body is required"),
    html: z.string().min(1).optional(),
    inReplyTo: z.string().min(1).optional(),
    references: z.string().min(1).optional()
});
