import {
  createEmailAccount,
  getUserEmailAccounts,
  getEmailAccount,
  getDefaultEmailAccount,
  updateEmailAccount,
  deleteEmailAccount,
  updateEmailAccountTokens,
  EMAIL_PROVIDERS
} from "./email-account.service.js";
import { getGmailAuthUrl, exchangeGmailCode, getGmailProfileFromTokens, validateGmailConfig } from "./oauth/gmail.oauth.service.js";
import { getOutlookAuthUrl, exchangeOutlookCode, validateOutlookConfig } from "./oauth/outlook.oauth.service.js";
import { testImapConnection, getImapFolders } from "./imap/imap-sync.service.js";
import { testSmtpConnection } from "./smtp/smtp.service.js";
import { triggerAccountSync, getWorkerStats, triggerManualSync } from "./worker/email-sync-worker.js";
import { AppError } from "../../shared/errors/AppError.js";
import { env } from "../../config/env.js";
import { isPlatformSmtpConfigured } from "../../shared/mail/platform-mailer.js";

/**
 * Which connection methods are available on this server — lets the UI
 * gracefully disable OAuth buttons the platform admin hasn't configured
 * instead of failing with a raw 500.
 */
export async function getEmailProvidersStatusHandler(req, res) {
  const configured = (v) =>
    Boolean(v) && !String(v).toLowerCase().includes("your-");

  res.json({
    success: true,
    data: {
      gmailOAuth: configured(env.GOOGLE_CLIENT_ID) && configured(env.GOOGLE_CLIENT_SECRET),
      outlookOAuth:
        configured(env.MICROSOFT_CLIENT_ID) && configured(env.MICROSOFT_CLIENT_SECRET),
      appPassword: true,
      platformSmtp: isPlatformSmtpConfigured()
    }
  });
}

/**
 * Email Account Controller
 * Handles HTTP requests for email account management
 */

/**
 * Create a new email account
 */
export async function createEmailAccountHandler(req, res) {
  const userId = req.currentUser?.id || req.user?.sub; const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;
  const data = req.body;

  const account = await createEmailAccount(userId, tenantId, data);

  res.status(201).json({
    success: true,
    data: account
  });
}

/**
 * Get all email accounts for the current user
 */
export async function getUserEmailAccountsHandler(req, res) {
  const userId = req.currentUser?.id || req.user?.sub; const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;

  const accounts = await getUserEmailAccounts(userId, tenantId);

  res.json({
    success: true,
    data: accounts
  });
}

/**
 * Get a specific email account
 */
export async function getEmailAccountHandler(req, res) {
  const userId = req.currentUser?.id || req.user?.sub; const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;
  const { accountId } = req.params;

  const account = await getEmailAccount(accountId, userId, tenantId);

  res.json({
    success: true,
    data: account
  });
}

/**
 * Get the default email account
 */
export async function getDefaultEmailAccountHandler(req, res) {
  const userId = req.currentUser?.id || req.user?.sub; const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;

  const account = await getDefaultEmailAccount(userId, tenantId);

  if (!account) {
    return res.json({
      success: true,
      data: null
    });
  }

  res.json({
    success: true,
    data: account
  });
}

/**
 * Update an email account
 */
export async function updateEmailAccountHandler(req, res) {
  const userId = req.currentUser?.id || req.user?.sub; const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;
  const { accountId } = req.params;
  const data = req.body;

  const account = await updateEmailAccount(accountId, userId, tenantId, data);

  res.json({
    success: true,
    data: account
  });
}

/**
 * Delete an email account
 */
export async function deleteEmailAccountHandler(req, res) {
  const userId = req.currentUser?.id || req.user?.sub; const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;
  const { accountId } = req.params;

  const result = await deleteEmailAccount(accountId, userId, tenantId);

  res.json({
    success: true,
    data: result
  });
}

/**
 * Get OAuth authorization URL for a provider
 */
export async function getOAuthUrlHandler(req, res) {
  const { provider } = req.params;
  const { state } = req.query;

  let authUrl;

  if (provider === EMAIL_PROVIDERS.GMAIL) {
    validateGmailConfig();
    authUrl = getGmailAuthUrl(state);
  } else if (provider === EMAIL_PROVIDERS.OUTLOOK) {
    validateOutlookConfig();
    authUrl = await getOutlookAuthUrl(state);
  } else {
    throw new AppError(`Unsupported OAuth provider: ${provider}`, 400);
  }

  res.json({
    success: true,
    data: {
      authUrl,
      provider
    }
  });
}

/**
 * Handle OAuth callback and create/update email account
 */
export async function handleOAuthCallbackHandler(req, res) {
  const userId = req.currentUser?.id || req.user?.sub; const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;
  const { provider } = req.params;
  const { code } = req.body;

  // 1) Exchange the code and learn WHOSE mailbox this is — before any
  //    database row exists (no temp accounts, no placeholder emails).
  let tokens;
  let email = null;
  let displayName = null;

  if (provider === EMAIL_PROVIDERS.GMAIL) {
    tokens = await exchangeGmailCode(code);
    const profile = await getGmailProfileFromTokens(tokens);
    email = profile.emailAddress || null;
    displayName = profile.emailAddress || null;
  } else if (provider === EMAIL_PROVIDERS.OUTLOOK) {
    tokens = await exchangeOutlookCode(code);
    email = tokens.email || null;
    displayName = tokens.displayName || tokens.email || null;
  } else {
    throw new AppError(`Unsupported OAuth provider: ${provider}`, 400);
  }

  if (!email) {
    throw new AppError(
      "Sign-in succeeded but we could not read the mailbox address. Please try connecting again.",
      400
    );
  }

  // 2) Create the account — or, on reconnect, refresh the stored tokens
  //    of the existing one (never a duplicate, never a 409).
  const existingAccounts = await getUserEmailAccounts(userId, tenantId);
  const existing = existingAccounts.find(
    (a) => a.provider === provider && a.email?.toLowerCase() === email.toLowerCase()
  );

  const tokenPayload = {
    accessToken: tokens.accessToken,
    ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
    tokenExpiresAt: tokens.expiresAt,
    displayName: displayName || email,
    isActive: true
  };

  const account = existing
    ? await updateEmailAccount(existing.id, userId, tenantId, tokenPayload)
    : await createEmailAccount(userId, tenantId, {
        provider,
        email,
        ...tokenPayload,
        isDefault: existingAccounts.length === 0
      });

  // 3) Kick off the first sync in the background so mail starts flowing
  //    immediately; the response does not wait for it.
  triggerAccountSync(account.id).catch((err) =>
    console.warn(`[OAuth] Initial sync for ${email} deferred: ${err.message}`)
  );

  res.json({
    success: true,
    data: account
  });
}

/**
 * Test IMAP connection for an account
 */
export async function testImapConnectionHandler(req, res) {
  const userId = req.currentUser?.id || req.user?.sub; const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;
  const { accountId } = req.params;

  const account = await getEmailAccount(accountId, userId, tenantId);
  const result = await testImapConnection(account);

  res.json({
    success: true,
    data: result
  });
}

/**
 * Test SMTP connection for an account
 */
export async function testSmtpConnectionHandler(req, res) {
  const userId = req.currentUser?.id || req.user?.sub; const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;
  const { accountId } = req.params;

  const account = await getEmailAccount(accountId, userId, tenantId);
  const result = await testSmtpConnection(account);

  res.json({
    success: true,
    data: result
  });
}

/**
 * Get IMAP folders for an account
 */
export async function getImapFoldersHandler(req, res) {
  const userId = req.currentUser?.id || req.user?.sub; const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;
  const { accountId } = req.params;

  const account = await getEmailAccount(accountId, userId, tenantId);
  const folders = await getImapFolders(account);

  res.json({
    success: true,
    data: folders
  });
}

/**
 * Trigger manual sync for a specific account
 */
export async function triggerAccountSyncHandler(req, res) {
  const userId = req.currentUser?.id || req.user?.sub; const tenantId = req.tenantId ?? req.currentUser?.tenantId ?? null;
  const { accountId } = req.params;

  // Verify ownership
  await getEmailAccount(accountId, userId, tenantId);

  const result = await triggerAccountSync(accountId);

  res.json({
    success: true,
    data: result
  });
}

/**
 * Trigger manual sync for all accounts
 */
export async function triggerManualSyncHandler(req, res) {
  const result = await triggerManualSync();

  res.json({
    success: true,
    data: result
  });
}

/**
 * Get email sync worker statistics
 */
export async function getWorkerStatsHandler(req, res) {
  const stats = getWorkerStats();

  res.json({
    success: true,
    data: stats
  });
}
