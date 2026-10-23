import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { ImapFlow } from "imapflow";
import { getEmailAccountTokens } from "../email-account.service.js";
import { AppError } from "../../../shared/errors/AppError.js";

/**
 * SMTP Service — sends mail directly through the agent's connected mailbox
 * (Gmail / Outlook via OAuth2 XOAUTH2, or any mail server via an app
 * password). No third-party email API is involved: because the message is
 * submitted through the agent's own mailbox, it also lands in the agent's
 * Sent folder at their provider (Gmail/Outlook file SMTP submissions
 * automatically; for custom servers we additionally APPEND the message to
 * the Sent mailbox over IMAP), so HelpCentre Pro and the agent's mailbox
 * always show the same sent mail.
 */

export function isPasswordAccount(account) {
    return account?.provider === "custom";
}

/** Refresh OAuth tokens when close to expiry (Gmail / Outlook accounts). */
export async function ensureFreshAccessToken(account) {
    if (isPasswordAccount(account)) return null;
    const tokens = await getEmailAccountTokens(account.id);
    const expiresSoon =
        tokens.expiresAt &&
        new Date(tokens.expiresAt).getTime() < Date.now() + 5 * 60 * 1000;
    if (!expiresSoon || !tokens.refreshToken) return tokens;

    try {
        if (account.provider === "gmail") {
            const { refreshGmailToken } = await import("../oauth/gmail.oauth.service.js");
            return refreshGmailToken(account.id);
        }
        if (account.provider === "outlook") {
            const { refreshOutlookToken } = await import("../oauth/outlook.oauth.service.js");
            return refreshOutlookToken(account.id);
        }
    } catch (error) {
        console.error(`Token refresh failed for ${account.email}:`, error.message);
    }
    return tokens;
}

/** The decrypted secret: OAuth access token, or app password for custom. */
export async function getAccountSecret(account) {
    await ensureFreshAccessToken(account);
    const tokens = await getEmailAccountTokens(account.id);
    if (!tokens.accessToken) {
        throw new AppError(
            "This mailbox has no credentials stored. Reconnect it in Settings → Email.",
            400
        );
    }
    return tokens.accessToken;
}

export function buildImapAuth(account, secret) {
    return isPasswordAccount(account)
        ? { user: account.email, pass: secret }
        : { user: account.email, accessToken: secret };
}

function buildSmtpAuth(account, secret) {
    return isPasswordAccount(account)
        ? { user: account.email, pass: secret }
        : { type: "OAuth2", user: account.email, accessToken: secret };
}

async function createSmtpTransporter(account, { verify = false } = {}) {
    const secret = await getAccountSecret(account);

    const transporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        auth: buildSmtpAuth(account, secret),
        tls: { rejectUnauthorized: false },
        // Prevent "Sending…" from hanging forever on a dead SMTP host.
        connectionTimeout: 12_000,
        greetingTimeout: 12_000,
        socketTimeout: 25_000
    });

    // Only verify on explicit connection tests — verifying on every reply
    // doubles latency and is the main cause of stuck Send buttons.
    if (verify) {
        await transporter.verify();
    }
    return transporter;
}

/** Locate the Sent mailbox path (\Sent special-use, with common fallbacks). */
export async function findSentMailboxPath(client) {
    const boxes = await client.list();
    const bySpecialUse = boxes.find(
        (b) => b.specialUse === "\\Sent" || b.flags?.has?.("\\Sent")
    );
    if (bySpecialUse) return bySpecialUse.path;
    const candidates = ["Sent", "Sent Items", "Sent Mail", "[Gmail]/Sent Mail", "INBOX.Sent"];
    const match = boxes.find((b) =>
        candidates.some((c) => c.toLowerCase() === b.path.toLowerCase())
    );
    return match?.path || "Sent";
}

/**
 * APPEND a raw message to the account's Sent folder (custom servers only —
 * Gmail/Outlook already file SMTP submissions into Sent automatically, and
 * the Sent-folder sync imports those copies into HelpCentre Pro).
 */
export async function appendToSentFolder(account, rawMessage) {
    if (!isPasswordAccount(account)) {
        return { appended: false, reason: "provider_auto_files_sent" };
    }
    const secret = await getAccountSecret(account);
    const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: account.imapSecure,
        auth: buildImapAuth(account, secret),
        logger: false
    });
    client.on("error", (err) => {
        console.error(`[IMAP Sent] ${account.email}:`, err?.message || err);
    });
    try {
        await client.connect();
        const sentPath = await findSentMailboxPath(client);
        await client.append(sentPath, rawMessage, ["\\Seen"]);
        return { appended: true, mailbox: sentPath };
    } finally {
        try {
            await client.logout();
        } catch {
            /* noop */
        }
    }
}

async function buildRawMessage(mailOptions) {
    return new Promise((resolve, reject) => {
        new MailComposer(mailOptions).compile().build((err, message) => {
            if (err) reject(err);
            else resolve(message);
        });
    });
}

/**
 * Send email via the account's SMTP server.
 */
export async function sendEmailViaSmtp(account, emailData) {
    const { to, subject, text, html, inReplyTo, references, attachments = [] } = emailData;

    let transporter = null;
    try {
        transporter = await createSmtpTransporter(account);

        const mailOptions = {
            from: account.displayName
                ? `"${String(account.displayName).replace(/"/g, "")}" <${account.email}>`
                : account.email,
            to: Array.isArray(to) ? to.join(", ") : to,
            subject,
            ...(text ? { text } : {}),
            ...(html ? { html } : {}),
            ...(inReplyTo ? { inReplyTo } : {}),
            ...(references ? { references } : {}),
            ...(attachments.length > 0 ? { attachments } : {})
        };

        const info = await transporter.sendMail(mailOptions);

        // Append to Sent in the background so a slow IMAP host never blocks
        // the agent UI on "Sending…". Gmail/Outlook already file SMTP mail.
        if (isPasswordAccount(account)) {
            buildRawMessage({ ...mailOptions, messageId: info.messageId })
                .then((raw) => appendToSentFolder(account, raw))
                .catch((appendError) => {
                    console.warn(
                        `Sent-folder append failed for ${account.email}:`,
                        appendError.message
                    );
                });
        }

        return {
            success: true,
            messageId: info.messageId,
            response: info.response,
            sentFolder: { appended: isPasswordAccount(account), deferred: true }
        };
    } catch (error) {
        console.error("SMTP send error:", error);
        throw new AppError(`Failed to send email via your mailbox: ${error.message}`, 502);
    } finally {
        if (transporter) transporter.close();
    }
}

/**
 * Test SMTP connection
 */
export async function testSmtpConnection(account) {
    try {
        const transporter = await createSmtpTransporter(account, { verify: true });
        transporter.close();
        return { success: true, message: "SMTP connection successful" };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Send email with reply tracking
 */
export async function sendReplyEmail(account, toEmail, subject, body, threadHeaders = {}) {
    const { inReplyTo, references } = threadHeaders;

    return sendEmailViaSmtp(account, {
        to: toEmail,
        subject,
        text: body,
        html: undefined,
        inReplyTo,
        references
    });
}

/**
 * Send email with attachments
 */
export async function sendEmailWithAttachments(account, toEmail, subject, body, attachments) {
    return sendEmailViaSmtp(account, {
        to: toEmail,
        subject,
        text: body,
        attachments
    });
}

export default {
    sendEmailViaSmtp,
    sendReplyEmail,
    testSmtpConnection,
    appendToSentFolder,
    ensureFreshAccessToken,
    getAccountSecret,
    buildImapAuth,
    isPasswordAccount
};
