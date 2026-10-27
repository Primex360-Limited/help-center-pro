/**
 * Shared mailbox credential / Zoho host helpers for IMAP + SMTP.
 */

/** Strip paste artifacts (newlines) and Zoho app-password display spaces. */
export function sanitizeMailboxSecret(secret) {
    return String(secret || "")
        .replace(/[\r\n\t]/g, "")
        .replace(/ /g, "")
        .trim();
}

export function isZohoMailbox({ email, imapHost, smtpHost } = {}) {
    const hay = `${email || ""} ${imapHost || ""} ${smtpHost || ""}`.toLowerCase();
    return hay.includes("zoho");
}

export function isZohoPersonalEmail(email = "") {
    return /@(zoho|zohomail)\.(com|eu|in|com\.au|jp)$/i.test(String(email || ""));
}

/** Datacenter suffix from host or MX-style clue (.com / .eu / .in / …). */
export function zohoDcSuffix(host = "") {
    const h = String(host || "").toLowerCase();
    if (h.includes("zoho.eu")) return "zoho.eu";
    if (h.includes("zoho.in")) return "zoho.in";
    if (h.includes("zoho.com.au")) return "zoho.com.au";
    if (h.includes("zoho.jp")) return "zoho.jp";
    return "zoho.com";
}

/**
 * Ordered IMAP hosts to try for a Zoho mailbox.
 * Paid custom domains → imappro.*; free org / personal → imap.*.
 */
export function zohoImapHostCandidates(account = {}) {
    const email = String(account.email || "").toLowerCase();
    const current = String(account.imapHost || "").toLowerCase();
    const dc = zohoDcSuffix(current || account.smtpHost || "");
    const personal = isZohoPersonalEmail(email);
    const ordered = [];

    if (current) ordered.push(current);

    if (!personal) {
        ordered.push(`imappro.${dc}`, `imap.${dc}`);
        if (dc !== "zoho.com") {
            ordered.push("imappro.zoho.com", "imap.zoho.com");
        }
    } else {
        ordered.push(`imap.${dc}`);
        if (dc !== "zoho.com") ordered.push("imap.zoho.com");
    }

    return [...new Set(ordered.filter(Boolean))];
}

export function zohoSmtpHostCandidates(account = {}) {
    const email = String(account.email || "").toLowerCase();
    const current = String(account.smtpHost || "").toLowerCase();
    const dc = zohoDcSuffix(current || account.imapHost || "");
    const personal = isZohoPersonalEmail(email);
    const ordered = [];

    if (current) ordered.push(current);

    if (!personal) {
        ordered.push(`smtppro.${dc}`, `smtp.${dc}`);
        if (dc !== "zoho.com") {
            ordered.push("smtppro.zoho.com", "smtp.zoho.com");
        }
    } else {
        ordered.push(`smtp.${dc}`);
        if (dc !== "zoho.com") ordered.push("smtp.zoho.com");
    }

    return [...new Set(ordered.filter(Boolean))];
}

export function friendlyImapError(error, account = {}) {
    const raw = String(
        error?.responseText || error?.message || error || "IMAP connection failed"
    );
    const zoho = isZohoMailbox(account);

    if (/server details you are using seems incorrect/i.test(raw)) {
        return zoho
            ? "Zoho rejected this IMAP host. For custom domains try imappro.zoho.com:993 (or imap.zoho.com on free plans). Check Server Configuration Details inside Zoho Mail for your datacenter (.eu / .in)."
            : raw;
    }

    if (/yet to enable imap/i.test(raw)) {
        return "IMAP is disabled on this Zoho mailbox. In Zoho Mail → Settings → Mail Accounts → enable IMAP Access, then try again. Organization admins may need to allow IMAP in the email policy.";
    }

    if (/authenticationfailed|invalid credentials|auth/i.test(raw)) {
        return zoho
            ? "Zoho IMAP login failed. Enable IMAP in Zoho Mail → Settings → Mail Accounts, then use an Application-specific Password from accounts.zoho.com → Security (not your normal password). Username must be the full email address."
            : `${raw}. Use an app password and the full email as username.`;
    }

    if (/command failed/i.test(raw) && error?.responseText) {
        return friendlyImapError(
            { message: error.responseText, responseText: error.responseText },
            account
        );
    }

    return raw;
}
