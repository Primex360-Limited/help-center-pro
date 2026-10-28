import { google } from "googleapis";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { updateEmailAccountTokens, getEmailAccountTokens } from "../email-account.service.js";

/**
 * Gmail OAuth2 Service
 * Handles OAuth2 flow for Gmail integration
 */

/**
 * HelpCentre Pro syncs Gmail over IMAP and sends over SMTP using XOAUTH2.
 * Google only authorises IMAP/SMTP access with the full-mail scope below —
 * the narrower Gmail API scopes (gmail.readonly / gmail.send / …) are
 * rejected by imap.gmail.com and smtp.gmail.com. This one scope also covers
 * the Gmail API calls we make (profile lookup), so it is all we request.
 */
const SCOPES = ["https://mail.google.com/"];

/**
 * Get OAuth2 client for Gmail
 */
function getOAuth2Client() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError("Google OAuth credentials not configured", 500);
  }

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI || `${env.FRONTEND_URL}/settings/email/callback/gmail`
  );
}

/**
 * Generate authorization URL for Gmail OAuth
 */
export function getGmailAuthUrl(state = null) {
  const oauth2Client = getOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state: state || ""
  });

  return authUrl;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGmailCode(code) {
  const oauth2Client = getOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new AppError("Failed to obtain access token from Google", 400);
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null
  };
}

/**
 * Refresh Gmail access token
 */
export async function refreshGmailToken(accountId) {
  const tokens = await getEmailAccountTokens(accountId);

  if (!tokens.refreshToken) {
    throw new AppError("No refresh token available for this account", 400);
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: tokens.refreshToken
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    const newTokens = {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || tokens.refreshToken,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null
    };

    await updateEmailAccountTokens(accountId, null, null, newTokens);

    return newTokens;
  } catch (error) {
    console.error("Gmail token refresh error:", error);
    throw new AppError("Failed to refresh Gmail access token", 401);
  }
}

/**
 * Get authenticated Gmail API client
 */
export async function getGmailClient(accountId) {
  const tokens = await getEmailAccountTokens(accountId);

  // Check if token is expired or will expire soon (5 minutes buffer)
  if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date(Date.now() + 5 * 60 * 1000)) {
    const newTokens = await refreshGmailToken(accountId);
    tokens.accessToken = newTokens.accessToken;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Get the Gmail profile straight from freshly-exchanged tokens.
 * Used by the OAuth callback before any account row exists.
 */
export async function getGmailProfileFromTokens(tokens) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data;
}

/**
 * Get Gmail user profile
 */
export async function getGmailProfile(accountId) {
  const gmail = await getGmailClient(accountId);

  const profile = await gmail.users.getProfile({
    userId: "me"
  });

  return profile.data;
}

/**
 * Revoke Gmail access token
 */
export async function revokeGmailToken(accountId) {
  const tokens = await getEmailAccountTokens(accountId);

  if (!tokens.accessToken) {
    return;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.accessToken
  });

  try {
    await oauth2Client.revokeToken(tokens.accessToken);
  } catch (error) {
    console.error("Gmail token revocation error:", error);
    // Don't throw error, just log it
  }
}

/**
 * Validate Gmail configuration
 */
export function validateGmailConfig() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError(
      "Google sign-in is not configured on this server yet. Use “Any mailbox (app password)” to connect Gmail now, or ask your platform admin to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      503
    );
  }
  return true;
}

function encodeRfc2047(value = "") {
  const text = String(value);
  if (/^[\x20-\x7E]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function formatHeaderAddress(email, displayName) {
  const addr = String(email || "").trim();
  if (!addr) return "";
  if (!displayName) return addr;
  const safeName = encodeRfc2047(String(displayName).replace(/[\r\n"]/g, ""));
  return `"${safeName}" <${addr}>`;
}

function toHeaderList(value) {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean).join(", ");
  }
  return String(value).trim();
}

/**
 * Send mail through the Gmail API over HTTPS (works on Render / hosts that
 * block outbound SMTP to smtp.gmail.com). Uses the same OAuth token as IMAP.
 */
export async function sendViaGmailApi(account, emailData = {}) {
  if (!account?.id) {
    throw new AppError("Gmail account id is required for API send", 400);
  }

  const {
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    inReplyTo,
    references
  } = emailData;

  const toHeader = toHeaderList(to);
  if (!toHeader) {
    throw new AppError("Recipient email is required", 400);
  }

  const fromHeader = formatHeaderAddress(
    account.email,
    account.displayName || ""
  );
  const messageId = `<${cryptoRandomId()}@mail.gmail.com>`;
  const boundary = `hcp_${cryptoRandomId()}`;

  const plain =
    text ||
    (html
      ? String(html)
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "");
  const htmlBody =
    html ||
    `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.5">${escapeHtml(
      plain
    ).replace(/\r\n|\r|\n/g, "<br>\n")}</body></html>`;

  const headers = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    toHeaderList(cc) ? `Cc: ${toHeaderList(cc)}` : null,
    toHeaderList(bcc) ? `Bcc: ${toHeaderList(bcc)}` : null,
    `Subject: ${encodeRfc2047(subject || "(no subject)")}`,
    `Message-ID: ${messageId}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "X-Mailer: HelpCentre Pro"
  ].filter(Boolean);

  const mime = [
    ...headers,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    plain || "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody,
    `--${boundary}--`,
    ""
  ].join("\r\n");

  const raw = Buffer.from(mime, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  try {
    const gmail = await getGmailClient(account.id);
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw }
    });

    return {
      success: true,
      messageId,
      gmailId: response?.data?.id || null,
      response: "gmail-api",
      sentFolder: {
        appended: true,
        deferred: false,
        via: "gmail_api"
      }
    };
  } catch (error) {
    const detail =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Gmail API send failed";
    console.error(`[Gmail API] send failed for ${account.email}:`, detail);
    throw new AppError(`Failed to send via Gmail API: ${detail}`, 502);
  }
}

function cryptoRandomId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
