import { Resend } from "resend";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";

let resendClient = null;

function getResendClient() {
    if (resendClient) {
        return resendClient;
    }

    if (!env.RESEND_API_KEY || env.RESEND_API_KEY.includes("placeholder")) {
        throw new AppError(
            "Email is not configured. Set RESEND_API_KEY on this service (or on helpcentre-pro-notify).",
            503
        );
    }

    resendClient = new Resend(env.RESEND_API_KEY);
    return resendClient;
}

export function verifyResendWebhook(req) {
    if (!env.RESEND_WEBHOOK_SECRET) {
        return req.body;
    }

    try {
        return getResendClient().webhooks.verify({
            payload: JSON.stringify(req.body),
            headers: {
                id: req.headers["svix-id"],
                timestamp: req.headers["svix-timestamp"],
                signature: req.headers["svix-signature"]
            },
            webhookSecret: env.RESEND_WEBHOOK_SECRET
        });
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError("Invalid Resend webhook signature", 401);
    }
}

export async function getReceivedEmail(emailId) {
    if (!emailId) {
        return null;
    }

    const result = await getResendClient().emails.receiving.get(emailId);

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
    if (!env.SUPPORT_EMAIL_FROM && !env.EMAIL_FROM) {
        throw new AppError("SUPPORT_EMAIL_FROM / EMAIL_FROM is not configured", 503);
    }

    const result = await getResendClient().emails.send({
        from: env.SUPPORT_EMAIL_FROM || env.EMAIL_FROM,
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
