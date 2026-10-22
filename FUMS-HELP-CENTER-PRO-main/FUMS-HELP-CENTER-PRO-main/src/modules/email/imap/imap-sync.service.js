import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getEmailAccountTokens, updateEmailAccountSyncStatus } from "../email-account.service.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { ingestMailboxEmail, stripEmailHtml } from "../../tickets/email/support-email.service.js";
import {
    buildImapAuth,
    ensureFreshAccessToken,
    findSentMailboxPath
} from "../smtp/smtp.service.js";

/**
 * IMAP Sync Service — two-way mailbox synchronization.
 *
 * INBOX  → customer mail becomes tickets / thread replies in HelpCentre Pro.
 * Sent   → mail the agent sent directly from Gmail/Outlook/their mail app
 *          is appended to the matching HelpCentre Pro ticket.
 *
 * Guarantees:
 * - Dedupe by Message-ID: mail sent from HelpCentre Pro (filed into Sent
 *   by SMTP) is never imported twice.
 * - The agent's mailbox is never modified: messages are NOT flagged \Seen,
 *   so read state in Gmail/Outlook stays exactly as the agent left it.
 * - OAuth tokens are refreshed automatically before connecting.
 */

async function connectToImap(account) {
    await ensureFreshAccessToken(account);
    const tokens = await getEmailAccountTokens(account.id);

    if (!tokens.accessToken) {
        throw new AppError("No credentials available for IMAP connection", 400);
    }

    const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: account.imapSecure,
        auth: buildImapAuth(account, tokens.accessToken),
        logger: false
    });

    await client.connect();
    return client;
}

function firstAddress(addressObject) {
    const first = addressObject?.value?.[0];
    if (!first) return { email: null, name: null };
    return {
        email: first.address ? first.address.trim().toLowerCase() : null,
        name: first.name || null
    };
}

async function processMessage(parsed, account, direction) {
    const from = firstAddress(parsed.from);
    const to = firstAddress(parsed.to);
    const subject = parsed.subject || "No Subject";
    const textBody = parsed.text || stripEmailHtml(parsed.html || "") || "";
    const messageId = parsed.messageId || null;
    const references = Array.isArray(parsed.references)
        ? parsed.references.join(" ")
        : parsed.references || "";
    const inReplyTo = parsed.inReplyTo || null;
    const date = parsed.date || new Date();

    if (direction === "INBOX") {
        if (!from.email) return { skipped: true, reason: "No sender email" };
        return ingestMailboxEmail({
            account,
            direction: "INBOUND",
            fromEmail: from.email,
            fromName: from.name,
            toEmail: to.email || account.email,
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

    // Sent folder — mail the agent sent from their own mail app.
    if (!to.email) return { skipped: true, reason: "No recipient email" };
    return ingestMailboxEmail({
        account,
        direction: "OUTBOUND",
        fromEmail: from.email || account.email,
        fromName: from.name,
        toEmail: to.email,
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

async function syncFolder(client, account, folderPath, direction, { limit, since }) {
    let processed = 0;
    let skipped = 0;
    let duplicates = 0;
    let errors = 0;

    await client.mailboxOpen(folderPath);

    const search = {};
    if (since) search.since = since;

    // Fetch most recent messages (UIDs ascending — take the tail).
    const uids = await client.search(search, { uid: true });
    const selected = (uids || []).slice(-limit);

    for (const uid of selected) {
        try {
            const message = await client.fetchOne(uid, { source: true }, { uid: true });
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
            console.error(`[IMAP Sync] Message ${uid} in ${folderPath} failed:`, error.message);
        }
    }

    return { processed, skipped, duplicates, errors };
}

/**
 * Sync INBOX + Sent for one account.
 */
export async function syncEmailAccount(account, options = {}) {
    const { limit = 50 } = options;

    let client = null;
    const totals = { processed: 0, skipped: 0, duplicates: 0, errors: 0 };

    try {
        client = await connectToImap(account);
        await updateEmailAccountSyncStatus(account.id, "syncing");

        // Look back a little beyond the last sync to tolerate clock skew.
        const since = account.lastSyncedAt
            ? new Date(new Date(account.lastSyncedAt).getTime() - 24 * 60 * 60 * 1000)
            : null;

        const inbox = await syncFolder(client, account, "INBOX", "INBOX", { limit, since });
        Object.keys(totals).forEach((k) => (totals[k] += inbox[k]));

        try {
            const sentPath = await findSentMailboxPath(client);
            const sent = await syncFolder(client, account, sentPath, "SENT", { limit, since });
            Object.keys(totals).forEach((k) => (totals[k] += sent[k]));
        } catch (sentError) {
            console.warn(`[IMAP Sync] Sent folder unavailable for ${account.email}:`, sentError.message);
        }

        await updateEmailAccountSyncStatus(account.id, "completed");

        return { success: true, ...totals };
    } catch (error) {
        console.error(`[IMAP Sync] Error for account ${account.email}:`, error);
        await updateEmailAccountSyncStatus(account.id, "error", error.message);
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
        client = await connectToImap(account);
        await client.mailboxOpen("INBOX");
        return { success: true, message: "IMAP connection successful" };
    } catch (error) {
        return { success: false, message: error.message };
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
        client = await connectToImap(account);
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

export default { syncEmailAccount, testImapConnection, getImapFolders };
