import { ConfidentialClientApplication } from "@azure/msal-node";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { updateEmailAccountTokens, getEmailAccountTokens } from "../email-account.service.js";

/**
 * Outlook OAuth2 Service
 *
 * HelpCentre Pro syncs Outlook over IMAP and sends over SMTP using XOAUTH2,
 * so we must request delegated permissions on the Exchange Online resource
 * (https://outlook.office.com), NOT Microsoft Graph mail scopes — Graph
 * tokens are rejected by outlook.office365.com IMAP/SMTP.
 *
 * `offline_access` is what makes Microsoft issue a refresh token, and the
 * direct token-endpoint calls below are used (instead of MSAL's token
 * cache) so the refresh token is actually returned and can be stored,
 * encrypted, in our database.
 */

const SCOPES = [
  "https://outlook.office.com/IMAP.AccessAsUser.All",
  "https://outlook.office.com/SMTP.Send",
  "offline_access",
  "openid",
  "profile",
  "email"
];

const AUTHORITY = "https://login.microsoftonline.com/common";
const TOKEN_ENDPOINT = `${AUTHORITY}/oauth2/v2.0/token`;

function redirectUri() {
  return env.MICROSOFT_REDIRECT_URI || `${env.FRONTEND_URL}/settings/email/callback/outlook`;
}

function getMsalClient() {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw new AppError("Microsoft OAuth credentials not configured", 500);
  }

  return new ConfidentialClientApplication({
    auth: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      authority: AUTHORITY
    }
  });
}

/** Decode a JWT payload without verifying (claims are only used for identity display). */
export function decodeJwtClaims(token) {
  try {
    const payload = String(token).split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

async function postTokenRequest(params) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      ...params
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    const detail = data.error_description || data.error || `HTTP ${response.status}`;
    throw new AppError(`Microsoft sign-in failed: ${detail}`, 400);
  }

  const claims = data.id_token ? decodeJwtClaims(data.id_token) : null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: data.expires_in
      ? new Date(Date.now() + Number(data.expires_in) * 1000)
      : null,
    email: claims?.email || claims?.preferred_username || null,
    displayName: claims?.name || null
  };
}

/**
 * Generate authorization URL for Outlook OAuth
 */
export function getOutlookAuthUrl(state = null) {
  const msalClient = getMsalClient();

  return msalClient.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: redirectUri(),
    prompt: "consent",
    state: state || ""
  });
}

/**
 * Exchange authorization code for tokens (includes the refresh token).
 */
export async function exchangeOutlookCode(code) {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw new AppError("Microsoft OAuth credentials not configured", 500);
  }

  return postTokenRequest({
    code,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
    scope: SCOPES.join(" ")
  });
}

/**
 * Refresh Outlook access token using the stored refresh token.
 */
export async function refreshOutlookToken(accountId) {
  const tokens = await getEmailAccountTokens(accountId);

  if (!tokens.refreshToken) {
    throw new AppError(
      "This Outlook mailbox has no refresh token stored. Reconnect it in Settings → Email.",
      401
    );
  }

  const newTokens = await postTokenRequest({
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES.join(" ")
  });

  await updateEmailAccountTokens(accountId, null, null, {
    accessToken: newTokens.accessToken,
    refreshToken: newTokens.refreshToken || tokens.refreshToken,
    expiresAt: newTokens.expiresAt
  });

  return newTokens;
}

/**
 * Get a fresh-enough access token for an Outlook account.
 */
export async function getOutlookClient(accountId) {
  const tokens = await getEmailAccountTokens(accountId);

  if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date(Date.now() + 5 * 60 * 1000)) {
    const newTokens = await refreshOutlookToken(accountId);
    tokens.accessToken = newTokens.accessToken;
    tokens.refreshToken = newTokens.refreshToken;
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
}

/**
 * Best-effort profile from the access-token claims (the token audience is
 * Exchange Online, so Microsoft Graph /me is not callable with it).
 */
export async function getOutlookProfile(accountId) {
  const { accessToken } = await getOutlookClient(accountId);
  const claims = decodeJwtClaims(accessToken) || {};

  return {
    mail: claims.email || claims.upn || claims.preferred_username || null,
    userPrincipalName: claims.upn || claims.preferred_username || null,
    displayName: claims.name || null
  };
}

/**
 * Microsoft tokens are revoked by simply discarding them; they expire naturally.
 */
export async function revokeOutlookToken() {
  return true;
}

/**
 * Validate Outlook configuration
 */
export function validateOutlookConfig() {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw new AppError(
      "Microsoft sign-in is not configured on this server yet. Use “Any mailbox (app password)” to connect Outlook now, or ask your platform admin to set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.",
      503
    );
  }
  return true;
}

export default {
  getOutlookAuthUrl,
  exchangeOutlookCode,
  refreshOutlookToken,
  getOutlookClient,
  getOutlookProfile,
  revokeOutlookToken,
  validateOutlookConfig
};
