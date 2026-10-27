import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";

/**
 * Platform mailer — direct SMTP, no third-party email API (no Resend).
 *
 * Used for transactional mail (email verification, invitations, password
 * resets) and as the last-resort sender for support replies when an agent
 * has not connected a personal mailbox.
 *
 * Configure with SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS
 * (e.g. a Gmail app password, your company mail server, or any SMTP relay).
 * When SMTP is not configured in development, messages are logged to the
 * server console ("dev inbox") so flows remain testable end-to-end.
 */

let transporter = null;

export function isPlatformSmtpConfigured() {
    return Boolean(env.SMTP_HOST);
}

function getTransporter() {
    if (transporter) return transporter;

    transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        ...(env.SMTP_USER
            ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
            : {}),
        tls: { rejectUnauthorized: false },
        connectionTimeout: 12_000,
        greetingTimeout: 12_000,
        socketTimeout: 25_000
    });

    return transporter;
}

export async function sendPlatformEmail({
    to,
    cc,
    bcc,
    subject,
    html,
    text,
    from,
    replyTo,
    headers,
    attachments
}) {
    if (!env.EMAIL_ENABLED) {
        console.warn(`[email] EMAIL_ENABLED=false — skipped sending to ${to}: ${subject}`);
        return { skipped: true };
    }

    const sender = from || env.SUPPORT_EMAIL_FROM || env.EMAIL_FROM;
    if (!sender) {
        throw new AppError(
            "No sender address configured. Connect a mailbox in Settings → Email, or set EMAIL_FROM / SMTP_* for the platform mailbox.",
            503
        );
    }

    if (!isPlatformSmtpConfigured()) {
        if (env.NODE_ENV === "production") {
            throw new AppError(
                "Platform SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS so HelpCentre Pro can send email directly.",
                503
            );
        }
        // Dev inbox: log instead of sending so local flows work with zero setup.
        console.log(
            `\n[DEV INBOX] ✉️  To: ${to}\n[DEV INBOX] From: ${sender}\n[DEV INBOX] Subject: ${subject}\n[DEV INBOX] (Set SMTP_HOST/SMTP_USER/SMTP_PASS in .env to deliver for real)\n`
        );
        return { devLogged: true, messageId: `dev-${Date.now()}@helpcentre-pro.local` };
    }

    const info = await getTransporter().sendMail({
        from: sender,
        to,
        ...(cc ? { cc } : {}),
        ...(bcc ? { bcc } : {}),
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
        ...(replyTo ? { replyTo } : {}),
        ...(headers ? { headers } : {}),
        ...(attachments?.length ? { attachments } : {})
    });

    return { messageId: info.messageId, response: info.response };
}

export async function verifyPlatformSmtp() {
    if (!isPlatformSmtpConfigured()) {
        return { configured: false, message: "SMTP_HOST is not set" };
    }
    try {
        await getTransporter().verify();
        return { configured: true, message: "Platform SMTP connection successful" };
    } catch (error) {
        return { configured: true, ok: false, message: error.message };
    }
}

export default { sendPlatformEmail, isPlatformSmtpConfigured, verifyPlatformSmtp };
