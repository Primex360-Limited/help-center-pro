import { Resend } from "resend";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";

const resend = new Resend(env.RESEND_API_KEY);

export function verifyResendWebhook(req) {
    if (!env.RESEND_WEBHOOK_SECRET) {
        return req.body;
    }

    try {
        return resend.webhooks.verify({
            payload: JSON.stringify(req.body),
            headers: {
                id: req.headers["svix-id"],
                timestamp: req.headers["svix-timestamp"],
                signature: req.headers["svix-signature"]
            },
            webhookSecret: env.RESEND_WEBHOOK_SECRET
        });
    } catch {
        throw new AppError("Invalid Resend webhook signature", 401);
    }
}

export async function getReceivedEmail(emailId) {
    if (!emailId) {
        return null;
    }

    const result = await resend.emails.receiving.get(emailId);

    if (result.error) {
        throw new AppError(result.error.message || "Unable to fetch received email from Resend", 502);
    }

    return result.data;
}

export async function sendSupportEmail({
    to,
    subject,
    text,
    html,
    headers
}) {
    const result = await resend.emails.send({
        from: env.SUPPORT_EMAIL_FROM,
        to,
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
        ...(headers ? { headers } : {})
    });

    if (result.error) {
        throw new AppError(result.error.message || "Unable to send support email", 502);
    }

    return result.data;
}
