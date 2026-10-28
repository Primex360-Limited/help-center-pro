import crypto from "crypto";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { ImapFlow } from "imapflow";
import { getEmailAccountTokens } from "../email-account.service.js";
import { AppError } from "../../../shared/errors/AppError.js";
import {
    isZohoMailbox,
    sanitizeMailboxSecret,
    zohoSmtpHostCandidates
} from "../mailbox-credentials.util.js";
import prisma from "../../../database/prisma/client.js";

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

/**
 * Port 465 = implicit TLS (secure: true).
 * Port 587/25/2525 = STARTTLS (secure: false).
 * Fixes Zoho smtppro:465 saved with secure:false → "Unexpected socket close".
 */
export function inferSmtpSecure(port, explicit) {
    const p = Number(port);
    if (p === 465) return true;
    if (p === 587 || p === 25 || p === 2525) return false;
    if (explicit === true || explicit === false) return explicit;
    return false;
}

export function inferImapSecure(port, explicit) {
    const p = Number(port);
    if (p === 993) return true;
    if (p === 143) return false;
    if (explicit === true || explicit === false) return explicit;
    return true;
}

function isTlsMismatchError(error) {
    const msg = String(error?.message || error || "").toLowerCase();
    return (
        msg.includes("socket close") ||
        msg.includes("econnreset") ||
        msg.includes("wrong version number") ||
        msg.includes("ssl") ||
        msg.includes("tls") ||
        msg.includes("eproto") ||
        msg.includes("disconnected") ||
        msg.includes("connection closed") ||
        msg.includes("unexpected")
    );
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
            const { refreshOutlookToken } = await import(
                "../oauth/outlook.oauth.service.js"
            );
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
    return isPasswordAccount(account)
        ? sanitizeMailboxSecret(tokens.accessToken)
        : tokens.accessToken;
}

export function buildImapAuth(account, secret, { loginMethod } = {}) {
    if (!isPasswordAccount(account)) {
        return { user: account.email, accessToken: secret };
    }
    const auth = { user: account.email, pass: secret };
    // Zoho frequently rejects AUTHENTICATE PLAIN; LOGIN is reliable.
    if (loginMethod) auth.loginMethod = loginMethod;
    else if (/zoho/i.test(`${account.imapHost || ""} ${account.smtpHost || ""}`)) {
        auth.loginMethod = "LOGIN";
    }
    return auth;
}

function buildSmtpAuth(account, secret) {
    return isPasswordAccount(account)
        ? { user: account.email, pass: secret }
        : { type: "OAuth2", user: account.email, accessToken: secret };
}

function buildTransporterOptions(account, secret, secure) {
    const port = Number(account.smtpPort) || (secure ? 465 : 587);
    const options = {
        host: account.smtpHost,
        port,
        secure: Boolean(secure),
        auth: buildSmtpAuth(account, secret),
        tls: {
            rejectUnauthorized: false,
            minVersion: "TLSv1.2"
        },
        // Keep timeouts short — Render / cloud hosts often block SMTP and
        // otherwise nodemailer can hang until the reverse proxy drops the request.
        connectionTimeout: 12_000,
        greetingTimeout: 12_000,
        socketTimeout: 25_000,
        // One-shot send — avoid pooled sockets that die mid-flight.
        pool: false
    };

    // STARTTLS on submission ports
    if (!secure && (port === 587 || port === 25 || port === 2525)) {
        options.requireTLS = true;
    }

    return options;
}

async function createSmtpTransporter(account, { verify = false, secureOverride } = {}) {
    const secret = await getAccountSecret(account);
    const secure =
        secureOverride !== undefined
            ? Boolean(secureOverride)
            : inferSmtpSecure(account.smtpPort, account.smtpSecure);

    const transporter = nodemailer.createTransport(
        buildTransporterOptions(account, secret, secure)
    );

    if (verify) {
        await transporter.verify();
    }
    return { transporter, secure };
}

async function withSmtpRetry(account, run) {
    const preferred = inferSmtpSecure(account.smtpPort, account.smtpSecure);
    try {
        return await run(preferred);
    } catch (firstError) {
        if (!isPasswordAccount(account) || !isTlsMismatchError(firstError)) {
            throw firstError;
        }
        const alternate = !preferred;
        console.warn(
            `[SMTP] ${account.email}: ${firstError.message} — retrying with secure=${alternate}`
        );
        try {
            return await run(alternate);
        } catch (secondError) {
            throw secondError;
        }
    }
}

/** Locate the Sent mailbox path (\Sent special-use, with common fallbacks). */
export async function findSentMailboxPath(client) {
    const boxes = await client.list();
    const bySpecialUse = boxes.find(
        (b) => b.specialUse === "\\Sent" || b.flags?.has?.("\\Sent")
    );
    if (bySpecialUse) return bySpecialUse.path;
    const candidates = [
        "Sent",
        "Sent Items",
        "Sent Mail",
        "[Gmail]/Sent Mail",
        "INBOX.Sent"
    ];
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
    const secure = inferImapSecure(account.imapPort, account.imapSecure);
    const client = new ImapFlow({
        host: account.imapHost,
        port: Number(account.imapPort) || 993,
        secure,
        auth: buildImapAuth(account, secret),
        logger: false,
        tls: { rejectUnauthorized: false, minVersion: "TLSv1.2" }
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

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Wrap plain text as a minimal UTF-8 HTML document for multipart/alternative. */
export function plainTextToHtml(text = "") {
    const escaped = escapeHtml(text).replace(/\r\n|\r|\n/g, "<br>\n");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;line-height:1.5;color:#111">${escaped}</body></html>`;
}

function extractEmailDomain(fromAddress) {
    const match = String(fromAddress || "").match(/@([^\s>]+)/);
    return match?.[1]?.replace(/[>;]+$/, "") || null;
}

function formatAddressList(value) {
    if (!value) return undefined;
    if (Array.isArray(value)) {
        const list = value.map((v) => String(v).trim()).filter(Boolean);
        return list.length ? list.join(", ") : undefined;
    }
    const trimmed = String(value).trim();
    return trimmed || undefined;
}

function buildTransactionalHeaders({
    fromAddress,
    listUnsubscribeEmail,
    extraHeaders = {},
    bulk = false,
    autoSubmitted = false
}) {
    const headers = {
        "X-Mailer": "HelpCentre Pro",
        ...extraHeaders
    };

    if (listUnsubscribeEmail) {
        headers["List-Unsubscribe"] =
            `<mailto:${listUnsubscribeEmail}?subject=unsubscribe>`;
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    if (bulk) {
        headers.Precedence = "bulk";
    }
    if (autoSubmitted) {
        headers["Auto-Submitted"] = "auto-generated";
    }

    const domain = extractEmailDomain(fromAddress);
    if (domain && !headers["Message-ID"] && !headers.messageId) {
        headers["Message-ID"] =
            `<${crypto.randomBytes(12).toString("hex")}@${domain}>`;
    }

    return headers;
}

function friendlySmtpError(error, account = {}) {
    const msg = String(error?.message || error || "");
    if (/timeout|etimedout|timed out|hang up|econnrefused|network/i.test(msg)) {
        return `${msg}. Outbound SMTP is often blocked on cloud hosts (e.g. Render). Connect Gmail with Google sign-in so replies send over HTTPS, or use an SMTP relay allowed from this server.`;
    }
    if (isTlsMismatchError(error)) {
        return `${msg}. Check SMTP port and encryption: use 465 with SSL, or 587 with STARTTLS. For Zoho custom domains use smtppro.zoho.com.`;
    }
    if (/auth|invalid credentials|535|534/i.test(msg)) {
        if (isZohoMailbox(account)) {
            return "Zoho SMTP login failed. Use an Application-specific Password from accounts.zoho.com → Security, full email as username, and smtppro.zoho.com:465 for custom domains.";
        }
        return `${msg}. Use an app password (not your normal login password) and the full email as username.`;
    }
    return msg;
}

function withHardTimeout(promise, ms, message) {
    let timer = null;
    return Promise.race([
        Promise.resolve(promise).finally(() => {
            if (timer) clearTimeout(timer);
        }),
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new AppError(message, 504));
            }, ms);
        })
    ]);
}

/**
 * Send email via the account's SMTP server.
 * Accepts cc, bcc, html; builds multipart text+html when possible.
 */
export async function sendEmailViaSmtp(account, emailData) {
    const {
        to,
        cc,
        bcc,
        subject,
        text,
        html,
        inReplyTo,
        references,
        attachments = [],
        headers: extraHeaders = {},
        listUnsubscribeEmail = null,
        bulk = false,
        autoSubmitted = false
    } = emailData;

    const canUseGmailApi =
        account?.provider === "gmail" &&
        account?.id &&
        (!attachments || attachments.length === 0);

    try {
        return await withHardTimeout(
            withSmtpRetry(account, async (secure) => {
            let transporter = null;
            try {
                ({ transporter } = await createSmtpTransporter(account, {
                    secureOverride: secure
                }));

                const fromAddress = account.displayName
                    ? `"${String(account.displayName).replace(/"/g, "")}" <${account.email}>`
                    : account.email;

                let plainText = text || undefined;
                let htmlBody = html || undefined;

                if (htmlBody && !plainText) {
                    plainText = String(htmlBody)
                        .replace(/<style[\s\S]*?<\/style>/gi, "")
                        .replace(/<[^>]+>/g, " ")
                        .replace(/\s+/g, " ")
                        .trim();
                }
                if (plainText && !htmlBody) {
                    htmlBody = plainTextToHtml(plainText);
                }

                const headers = buildTransactionalHeaders({
                    fromAddress,
                    listUnsubscribeEmail:
                        listUnsubscribeEmail || account.email || null,
                    extraHeaders,
                    bulk,
                    autoSubmitted
                });

                const messageIdHeader = headers["Message-ID"];
                if (messageIdHeader) {
                    delete headers["Message-ID"];
                }

                const mailOptions = {
                    from: fromAddress,
                    to: formatAddressList(to),
                    ...(formatAddressList(cc)
                        ? { cc: formatAddressList(cc) }
                        : {}),
                    ...(formatAddressList(bcc)
                        ? { bcc: formatAddressList(bcc) }
                        : {}),
                    subject,
                    ...(plainText ? { text: plainText } : {}),
                    ...(htmlBody ? { html: htmlBody } : {}),
                    ...(inReplyTo ? { inReplyTo } : {}),
                    ...(references ? { references } : {}),
                    ...(attachments.length > 0 ? { attachments } : {}),
                    headers,
                    ...(messageIdHeader ? { messageId: messageIdHeader } : {})
                };

                const info = await transporter.sendMail(mailOptions);

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
                    sentFolder: {
                        appended: isPasswordAccount(account),
                        deferred: true
                    }
                };
            } finally {
                if (transporter) {
                    try {
                        transporter.close();
                    } catch {
                        /* noop */
                    }
                }
            }
        }),
            // Fail SMTP quickly so Gmail API fallback can run on blocked hosts.
            canUseGmailApi ? 18_000 : 45_000,
            "Mailbox SMTP timed out. On Render and similar hosts, connect Gmail with Google sign-in (HTTPS) or use an allowed SMTP relay."
        );
    } catch (smtpError) {
        if (canUseGmailApi) {
            console.warn(
                `[SMTP] ${account.email} SMTP failed (${smtpError?.message || smtpError}); falling back to Gmail API`
            );
            try {
                const { sendViaGmailApi } = await import(
                    "../oauth/gmail.oauth.service.js"
                );
                return await withHardTimeout(
                    sendViaGmailApi(account, {
                        to,
                        cc,
                        bcc,
                        subject,
                        text,
                        html,
                        inReplyTo,
                        references
                    }),
                    40_000,
                    "Gmail send timed out. Please try again in a moment."
                );
            } catch (apiError) {
                console.error(
                    `[SMTP] Gmail API fallback also failed for ${account.email}:`,
                    apiError?.message || apiError
                );
                if (apiError instanceof AppError) throw apiError;
                throw new AppError(
                    `Failed to send email via your mailbox: ${friendlySmtpError(apiError, account)}`,
                    502
                );
            }
        }

        console.error("SMTP send error:", smtpError);
        if (smtpError instanceof AppError) throw smtpError;
        throw new AppError(
            `Failed to send email via your mailbox: ${friendlySmtpError(smtpError, account)}`,
            502
        );
    }
}

/**
 * Test SMTP connection
 */
export async function testSmtpConnection(account) {
    const hosts = isZohoMailbox(account)
        ? zohoSmtpHostCandidates(account)
        : [account.smtpHost];
    let lastError = null;

    for (const host of hosts) {
        const attempt = { ...account, smtpHost: host };
        try {
            await withSmtpRetry(attempt, async (secure) => {
                const { transporter } = await createSmtpTransporter(attempt, {
                    verify: true,
                    secureOverride: secure
                });
                transporter.close();
                return true;
            });
            if (account.id && host && host !== account.smtpHost) {
                try {
                    await prisma.emailAccount.update({
                        where: { id: account.id },
                        data: { smtpHost: host }
                    });
                } catch {
                    /* non-fatal */
                }
            }
            const hostNote =
                host && host !== account.smtpHost ? ` via ${host}` : "";
            return {
                success: true,
                message: `SMTP connection successful${hostNote}`,
                smtpHost: host
            };
        } catch (error) {
            lastError = error;
            console.warn(
                `[SMTP] ${account.email} verify failed on ${host}: ${error.message}`
            );
        }
    }

    return {
        success: false,
        message: friendlySmtpError(lastError, account)
    };
}

/**
 * Send email with reply tracking. Passes cc/bcc/html through when provided.
 */
export async function sendReplyEmail(
    account,
    toEmail,
    subject,
    body,
    threadHeaders = {}
) {
    const {
        inReplyTo,
        references,
        cc,
        bcc,
        html,
        listUnsubscribeEmail
    } = threadHeaders;

    return sendEmailViaSmtp(account, {
        to: toEmail,
        cc,
        bcc,
        subject,
        text: body,
        html,
        inReplyTo,
        references,
        listUnsubscribeEmail
    });
}

/**
 * Send email with attachments
 */
export async function sendEmailWithAttachments(
    account,
    toEmail,
    subject,
    body,
    attachments
) {
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
    isPasswordAccount,
    plainTextToHtml,
    inferSmtpSecure,
    inferImapSecure
};
