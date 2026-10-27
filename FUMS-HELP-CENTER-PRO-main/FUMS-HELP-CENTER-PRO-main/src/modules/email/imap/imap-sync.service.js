import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import {
    getEmailAccountTokens,
    updateEmailAccountSyncStatus
} from "../email-account.service.js";
import { AppError } from "../../../shared/errors/AppError.js";
import {
    ingestMailboxEmail,
    stripEmailHtml
} from "../../tickets/email/support-email.service.js";
import {
    buildImapAuth,
    ensureFreshAccessToken,
    findSentMailboxPath,
    inferImapSecure,
    isPasswordAccount
} from "../smtp/smtp.service.js";
import {
    friendlyImapError,
    isZohoMailbox,
    isZohoPersonalEmail,
    sanitizeMailboxSecret,
    zohoImapHostCandidates
} from "../mailbox-credentials.util.js";
import prisma from "../../../database/prisma/client.js";

/**
 * IMAP Sync Service — two-way mailbox synchronization.
 *
 * INBOX  → customer mail becomes tickets / thread replies in HelpCentre Pro.
 * Sent   → mail the agent sent directly from Gmail/Outlook/their mail app
 *          is appended to the matching HelpCentre Pro ticket.
 */

/** Zoho / Outlook host corrections so custom-domain mailboxes actually sync. */
export function normalizeImapAccount(account) {
    const email = String(account?.email || "").toLowerCase();
    const host = String(account?.imapHost || "").toLowerCase();
    const next = { ...account };
    const personal = isZohoPersonalEmail(email);
    const looksZohoHost = host.includes("zoho");

    // Personal Zoho mistakenly on imappro → personal host
    if (personal && host.includes("imappro")) {
        if (email.includes(".eu")) next.imapHost = "imap.zoho.eu";
        else if (email.includes(".in")) next.imapHost = "imap.zoho.in";
        else next.imapHost = "imap.zoho.com";
    }

    // Custom domain on personal imap host — prefer imappro first (fallback tries imap)
    if (
        looksZohoHost &&
        !personal &&
        /^imap\.zoho\./i.test(host) &&
        !host.includes("imappro")
    ) {
        next.imapHost = host.replace(/^imap\./i, "imappro.");
    }

    // Outlook / Microsoft 365 common aliases
    if (
        host === "imap-mail.outlook.com" ||
        host === "outlook.live.com" ||
        host === "imap.office365.com"
    ) {
        next.imapHost = "outlook.office365.com";
    }

    next.imapPort = Number(next.imapPort) || 993;
    next.imapSecure = inferImapSecure(next.imapPort, next.imapSecure);
    return next;
}

function shouldRetryImapHost(error) {
    const text = `${error?.responseText || ""} ${error?.message || ""} ${error?.serverResponseCode || ""}`;
    return (
        error?.authenticationFailed === true ||
        /authenticationfailed|invalid credentials|server details you are using seems incorrect|auth/i.test(
            text
        )
    );
}

async function openImapClient(account, secret, { loginMethod } = {}) {
    const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: account.imapSecure,
        auth: buildImapAuth(account, secret, { loginMethod }),
        logger: false,
        tls: { rejectUnauthorized: false, minVersion: "TLSv1.2" },
        connectionTimeout: 20_000,
        greetingTimeout: 20_000
    });

    client.on("error", (err) => {
        console.error(`[IMAP] ${account.email}:`, err?.message || err);
    });

    await client.connect();
    return client;
}

async function persistImapHostIfChanged(accountId, previousHost, nextHost) {
    if (!accountId || !nextHost || previousHost === nextHost) return;
    try {
        await prisma.emailAccount.update({
            where: { id: accountId },
            data: { imapHost: nextHost }
        });
        console.info(
            `[IMAP] Persisted working host for ${accountId}: ${previousHost} → ${nextHost}`
        );
    } catch (err) {
        console.warn(`[IMAP] Could not persist host ${nextHost}:`, err.message);
    }
}

async function connectToImap(rawAccount) {
    const base = normalizeImapAccount(rawAccount);
    await ensureFreshAccessToken(base);
    const tokens = await getEmailAccountTokens(base.id);

    if (!tokens.accessToken) {
        throw new AppError("No credentials available for IMAP connection", 400);
    }

    const secret = isPasswordAccount(base)
        ? sanitizeMailboxSecret(tokens.accessToken)
        : tokens.accessToken;

    if (!secret) {
        throw new AppError("No credentials available for IMAP connection", 400);
    }

    const zoho = isZohoMailbox(base);
    const hosts = zoho ? zohoImapHostCandidates(base) : [base.imapHost];
    // Prefer LOGIN for Zoho; also try default SASL if LOGIN somehow fails.
    const loginMethods = zoho
        ? ["LOGIN", undefined]
        : isPasswordAccount(base)
          ? [undefined, "LOGIN"]
          : [undefined];

    let lastError = null;
    const originalHost = base.imapHost;

    for (const host of hosts) {
        for (const loginMethod of loginMethods) {
            const attempt = {
                ...base,
                imapHost: host,
                imapPort: Number(base.imapPort) || 993,
                imapSecure: inferImapSecure(base.imapPort, true)
            };
            try {
                const client = await openImapClient(attempt, secret, { loginMethod });
                await persistImapHostIfChanged(base.id, originalHost, host);
                return { client, account: attempt };
            } catch (error) {
                lastError = error;
                console.warn(
                    `[IMAP] ${base.email} failed on ${host}` +
                        `${loginMethod ? ` (${loginMethod})` : ""}: ${error?.responseText || error?.message}`
                );
                if (!shouldRetryImapHost(error) && hosts.length === 1) {
                    throw new AppError(friendlyImapError(error, attempt), 400);
                }
            }
        }
    }

    throw new AppError(friendlyImapError(lastError, base), 400);
}

function firstAddress(addressObject) {
    const first = addressObject?.value?.[0];
    if (!first) return { email: null, name: null };
    return {
        email: first.address ? first.address.trim().toLowerCase() : null,
        name: first.name || null
    };
}

/** Collect every address from To / Cc / Delivered-To style fields. */
function collectRecipients(parsed) {
    const emails = new Set();
    for (const field of ["to", "cc", "bcc"]) {
        const list = parsed?.[field]?.value || [];
        for (const entry of list) {
            if (entry?.address) emails.add(String(entry.address).trim().toLowerCase());
        }
    }
    return [...emails];
}

async function processMessage(parsed, account, direction) {
    const from = firstAddress(parsed.from);
    const to = firstAddress(parsed.to);
    const recipients = collectRecipients(parsed);
    const subject = parsed.subject || "No Subject";
    const textBody = parsed.text || stripEmailHtml(parsed.html || "") || "";
    const messageId = parsed.messageId || null;
    const references = Array.isArray(parsed.references)
        ? parsed.references.join(" ")
        : parsed.references || "";
    const inReplyTo = parsed.inReplyTo || null;
    const date = parsed.date || new Date();
    const accountEmail = String(account.email || "").trim().toLowerCase();

    if (direction === "INBOX") {
        if (!from.email) return { skipped: true, reason: "No sender email" };
        const toEmail =
            to.email ||
            recipients.find((e) => e === accountEmail) ||
            recipients[0] ||
            account.email;
        return ingestMailboxEmail({
            account,
            direction: "INBOUND",
            fromEmail: from.email,
            fromName: from.name,
            toEmail,
            subject,
            body: textBody,
            html: parsed.html || null,
            messageId,
            inReplyTo,
            references,
            receivedAt: date.toISOString(),
            attachments: (parsed.attachments || []).map((a) => ({
                filename: a.filename,
                contentType: a.contentType,
                size: a.size
            }))
        });
    }

    if (!to.email && !recipients.length) {
        return { skipped: true, reason: "No recipient email" };
    }
    return ingestMailboxEmail({
        account,
        direction: "OUTBOUND",
        fromEmail: from.email || account.email,
        fromName: from.name,
        toEmail: to.email || recipients[0],
        subject,
        body: textBody,
        html: parsed.html || null,
        messageId,
        inReplyTo,
        references,
        receivedAt: date.toISOString(),
        attachments: (parsed.attachments || []).map((a) => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size
        }))
    });
}

/**
 * Resolve UIDs to sync. Empty `{}` search returns nothing on many servers
 * (including Zoho) — always use explicit ALL / SINCE / UNSEEN criteria.
 */
async function resolveUidsToSync(client, { limit, since }) {
    const takeTail = (uids) => (uids || []).slice(-Math.max(1, limit));

    if (since) {
        try {
            const sinceUids = await client.search({ since }, { uid: true });
            if (sinceUids?.length) return takeTail(sinceUids);
        } catch (err) {
            console.warn(`[IMAP Sync] SINCE search failed: ${err.message}`);
        }
        try {
            const unseen = await client.search({ seen: false }, { uid: true });
            if (unseen?.length) return takeTail(unseen);
        } catch {
            /* fall through */
        }
    }

    try {
        const all = await client.search({ all: true }, { uid: true });
        return takeTail(all);
    } catch (err) {
        console.warn(`[IMAP Sync] ALL search failed: ${err.message}`);
    }

    // Last-resort: fetch by sequence if UID search is unsupported.
    try {
        const status = await client.status(client.mailbox.path, {
            messages: true
        });
        const total = Number(status?.messages || 0);
        if (!total) return [];
        const start = Math.max(1, total - limit + 1);
        const seq = [];
        for (let i = start; i <= total; i += 1) seq.push(i);
        return seq;
    } catch {
        return [];
    }
}

async function syncFolder(client, account, folderPath, direction, { limit, since }) {
    let processed = 0;
    let skipped = 0;
    let duplicates = 0;
    let errors = 0;

    await client.mailboxOpen(folderPath);

    const selected = await resolveUidsToSync(client, { limit, since });

    for (const id of selected) {
        try {
            // Prefer UID fetch; fall back to sequence if needed.
            let message = null;
            try {
                message = await client.fetchOne(
                    id,
                    { source: true },
                    { uid: true }
                );
            } catch {
                message = await client.fetchOne(id, { source: true });
            }
            if (!message?.source) {
                skipped++;
                continue;
            }
            const parsed = await simpleParser(message.source);
            const result = await processMessage(parsed, account, direction);
            if (result?.processed) processed++;
            else if (result?.duplicate) duplicates++;
            else skipped++;
        } catch (error) {
            errors++;
            console.error(
                `[IMAP Sync] Message ${id} in ${folderPath} failed:`,
                error.message
            );
        }
    }

    return { processed, skipped, duplicates, errors, examined: selected.length };
}

/**
 * Sync INBOX + Sent for one account.
 */
export async function syncEmailAccount(account, options = {}) {
    const { limit = 50, fullLookback = false } = options;

    let client = null;
    const totals = {
        processed: 0,
        skipped: 0,
        duplicates: 0,
        errors: 0,
        examined: 0
    };

    try {
        const connected = await connectToImap(account);
        client = connected.client;
        const normalized = connected.account;

        // Do not bump lastSyncedAt yet — only mark completed after a real pass.
        await updateEmailAccountSyncStatus(account.id, "syncing", null, {
            touchLastSyncedAt: false
        });

        // Look back far enough for first sync / recovery; otherwise 7 days.
        let since = null;
        if (!fullLookback && account.lastSyncedAt) {
            since = new Date(
                new Date(account.lastSyncedAt).getTime() - 7 * 24 * 60 * 60 * 1000
            );
        } else if (!account.lastSyncedAt || fullLookback) {
            since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        const inbox = await syncFolder(client, normalized, "INBOX", "INBOX", {
            limit,
            since
        });
        Object.keys(totals).forEach((k) => {
            if (inbox[k] !== undefined) totals[k] += inbox[k];
        });

        try {
            const sentPath = await findSentMailboxPath(client);
            const sent = await syncFolder(client, normalized, sentPath, "SENT", {
                limit: Math.min(limit, 30),
                since
            });
            Object.keys(totals).forEach((k) => {
                if (sent[k] !== undefined) totals[k] += sent[k];
            });
        } catch (sentError) {
            console.warn(
                `[IMAP Sync] Sent folder unavailable for ${account.email}:`,
                sentError.message
            );
        }

        await updateEmailAccountSyncStatus(account.id, "completed", null, {
            touchLastSyncedAt: true
        });

        console.log(
            `[IMAP Sync] ${account.email}: examined=${totals.examined} processed=${totals.processed} dupes=${totals.duplicates} skipped=${totals.skipped}`
        );

        return { success: true, ...totals };
    } catch (error) {
        console.error(`[IMAP Sync] Error for account ${account.email}:`, error);
        await updateEmailAccountSyncStatus(account.id, "error", error.message, {
            touchLastSyncedAt: false
        });
        return { success: false, error: error.message, ...totals };
    } finally {
        if (client) {
            try {
                await client.logout();
            } catch {
                /* noop */
            }
        }
    }
}

/**
 * Test IMAP connection
 */
export async function testImapConnection(account) {
    let client = null;
    try {
        const connected = await connectToImap(account);
        client = connected.client;
        await client.mailboxOpen("INBOX");
        const status = await client.status("INBOX", { messages: true });
        const hostNote =
            connected.account?.imapHost &&
            connected.account.imapHost !== account.imapHost
                ? ` via ${connected.account.imapHost}`
                : "";
        return {
            success: true,
            message: `IMAP connection successful${hostNote} (${status?.messages ?? 0} messages in INBOX)`,
            imapHost: connected.account?.imapHost || account.imapHost
        };
    } catch (error) {
        return {
            success: false,
            message: friendlyImapError(error, account)
        };
    } finally {
        if (client) {
            try {
                await client.logout();
            } catch {
                /* noop */
            }
        }
    }
}

/**
 * Get IMAP folders for an account
 */
export async function getImapFolders(account) {
    let client = null;
    try {
        const connected = await connectToImap(account);
        client = connected.client;
        const tree = await client.list();

        const folders = [];
        function traverse(node) {
            folders.push({
                name: node.name,
                path: node.path,
                specialUse: node.specialUse || null
            });
            if (node.children) node.children.forEach(traverse);
        }
        tree.forEach(traverse);

        return folders;
    } catch (error) {
        console.error("Error fetching IMAP folders:", error);
        throw new AppError("Failed to fetch IMAP folders", 500);
    } finally {
        if (client) {
            try {
                await client.logout();
            } catch {
                /* noop */
            }
        }
    }
}

export default { syncEmailAccount, testImapConnection, getImapFolders, normalizeImapAccount };
