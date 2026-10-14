import express from "express";
import { Resend } from "resend";
import asyncHandler from "../../middleware/async.middleware.js";
import { requireInternalKey } from "../../platform/requireInternalKey.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { getBrandLogoAttachment } from "../auth/emailTemplates/emailLayout.js";

const notificationRoutes = express.Router();

function getResendClient() {
    if (!env.RESEND_API_KEY || env.RESEND_API_KEY.includes("placeholder")) {
        throw new AppError(
            "Email is not configured. Set a valid RESEND_API_KEY in your .env file.",
            503
        );
    }

    return new Resend(env.RESEND_API_KEY);
}

/**
 * Internal-only email dispatch. Auth / identity / tickets call this over HTTP
 * when NOTIFICATION_SERVICE_URL is configured.
 */
notificationRoutes.post(
    "/internal/v1/email/send",
    requireInternalKey,
    asyncHandler(async (req, res) => {
        const { to, subject, html, from } = req.body || {};

        if (!to || !subject || !html) {
            throw new AppError("to, subject, and html are required", 400);
        }

        if (!env.EMAIL_ENABLED) {
            console.warn(`[notification] EMAIL_ENABLED=false — skipped ${to}: ${subject}`);
            return res.json({ success: true, skipped: true });
        }

        const sender = from || env.EMAIL_FROM;
        if (!sender) {
            throw new AppError("EMAIL_FROM is not configured", 503);
        }

        const resend = getResendClient();
        const logoAttachment = getBrandLogoAttachment();
        const payload = { from: sender, to, subject, html };

        if (logoAttachment) {
            payload.attachments = [logoAttachment];
        }

        const result = await resend.emails.send(payload);

        if (result?.error) {
            throw new AppError(
                result.error.message || "Failed to send email via Resend",
                502
            );
        }

        return res.status(202).json({
            success: true,
            data: result?.data || result
        });
    })
);

export default notificationRoutes;
