import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { encrypt, decrypt } from "../../shared/utils/encryption.util.js";

/**
 * Email Account Service
 * Manages user email accounts for bidirectional email synchronization
 */

const EMAIL_PROVIDERS = Object.freeze({
  GMAIL: "gmail",
  OUTLOOK: "outlook",
  CUSTOM: "custom"
});

const DEFAULT_IMAP_CONFIG = {
  [EMAIL_PROVIDERS.GMAIL]: {
    host: "imap.gmail.com",
    port: 993,
    secure: true
  },
  [EMAIL_PROVIDERS.OUTLOOK]: {
    host: "outlook.office365.com",
    port: 993,
    secure: true
  }
};

const DEFAULT_SMTP_CONFIG = {
  [EMAIL_PROVIDERS.GMAIL]: {
    host: "smtp.gmail.com",
    port: 587,
    secure: false
  },
  [EMAIL_PROVIDERS.OUTLOOK]: {
    host: "smtp.office365.com",
    port: 587,
    secure: false
  }
};

/**
 * Create a new email account for a user
 */
export async function createEmailAccount(userId, tenantId, data) {
  const { provider, email, displayName, accessToken, refreshToken, tokenExpiresAt, imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure, isDefault } = data;
  // App password (custom IMAP/SMTP accounts) — stored encrypted in the
  // accessToken column; OAuth accounts store their access token there.
  const secret = data.password || accessToken;

  // Validate provider
  if (!Object.values(EMAIL_PROVIDERS).includes(provider)) {
    throw new AppError(`Invalid email provider: ${provider}`, 400);
  }

  // Check if email account already exists for this user
  const existing = await prisma.emailAccount.findUnique({
    where: {
      userId_email: {
        userId,
        email
      }
    }
  });

  if (existing) {
    throw new AppError("Email account already exists for this user", 409);
  }

  // If setting as default, unset other defaults
  if (isDefault) {
    await prisma.emailAccount.updateMany({
      where: { userId },
      data: { isDefault: false }
    });
  }

  // Use default IMAP/SMTP config if not provided
  const finalImapHost = imapHost || DEFAULT_IMAP_CONFIG[provider]?.host;
  const finalImapPort = imapPort || DEFAULT_IMAP_CONFIG[provider]?.port;
  const finalImapSecure = imapSecure !== undefined ? imapSecure : DEFAULT_IMAP_CONFIG[provider]?.secure;
  const finalSmtpHost = smtpHost || DEFAULT_SMTP_CONFIG[provider]?.host;
  const finalSmtpPort = smtpPort || DEFAULT_SMTP_CONFIG[provider]?.port;
  const finalSmtpSecure = smtpSecure !== undefined ? smtpSecure : DEFAULT_SMTP_CONFIG[provider]?.secure;

  // Encrypt tokens / app password
  const encryptedAccessToken = secret ? encrypt(secret) : null;
  const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;

  const emailAccount = await prisma.emailAccount.create({
    data: {
      userId,
      tenantId,
      provider,
      email,
      displayName,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt,
      imapHost: finalImapHost,
      imapPort: finalImapPort,
      imapSecure: finalImapSecure,
      smtpHost: finalSmtpHost,
      smtpPort: finalSmtpPort,
      smtpSecure: finalSmtpSecure,
      isDefault: isDefault || false
    }
  });

  return mapEmailAccountResponse(emailAccount);
}

/**
 * Get all email accounts for a user
 */
export async function getUserEmailAccounts(userId, tenantId) {
  const accounts = await prisma.emailAccount.findMany({
    where: {
      userId,
      ...(tenantId ? { tenantId } : {})
    },
    orderBy: [
      { isDefault: "desc" },
      { createdAt: "desc" }
    ]
  });

  return accounts.map(mapEmailAccountResponse);
}

/**
 * Get a single email account by ID
 */
export async function getEmailAccount(accountId, userId, tenantId) {
  const account = await prisma.emailAccount.findFirst({
    where: {
      id: accountId,
      userId,
      ...(tenantId ? { tenantId } : {})
    }
  });

  if (!account) {
    throw new AppError("Email account not found", 404);
  }

  return mapEmailAccountResponse(account);
}

/**
 * Get the default email account for a user
 */
export async function getDefaultEmailAccount(userId, tenantId) {
  const account =
    (await prisma.emailAccount.findFirst({
      where: {
        userId,
        isDefault: true,
        isActive: true,
        ...(tenantId ? { tenantId } : {})
      }
    })) ||
    // Fall back to the agent's only/first active mailbox so sending works
    // without extra setup clicks.
    (await prisma.emailAccount.findFirst({
      where: {
        userId,
        isActive: true,
        ...(tenantId ? { tenantId } : {})
      },
      orderBy: { createdAt: "desc" }
    }));

  if (!account) {
    return null;
  }

  return mapEmailAccountResponse(account);
}

/**
 * Update an email account
 */
export async function updateEmailAccount(accountId, userId, tenantId, data) {
  const existing = await prisma.emailAccount.findFirst({
    where: {
      id: accountId,
      userId,
      ...(tenantId ? { tenantId } : {})
    }
  });

  if (!existing) {
    throw new AppError("Email account not found", 404);
  }

  const { email, displayName, accessToken, refreshToken, tokenExpiresAt, imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure, isActive, isDefault, syncEnabled } = data;

  // If setting as default, unset other defaults
  if (isDefault && !existing.isDefault) {
    await prisma.emailAccount.updateMany({
      where: { userId, id: { not: accountId } },
      data: { isDefault: false }
    });
  }

  const updateData = {};

  if (email !== undefined) updateData.email = email;
  if (displayName !== undefined) updateData.displayName = displayName;
  if (data.password !== undefined && data.password) updateData.accessToken = encrypt(data.password);
  if (accessToken !== undefined) updateData.accessToken = encrypt(accessToken);
  if (refreshToken !== undefined) updateData.refreshToken = encrypt(refreshToken);
  if (tokenExpiresAt !== undefined) updateData.tokenExpiresAt = tokenExpiresAt;
  if (imapHost !== undefined) updateData.imapHost = imapHost;
  if (imapPort !== undefined) updateData.imapPort = imapPort;
  if (imapSecure !== undefined) updateData.imapSecure = imapSecure;
  if (smtpHost !== undefined) updateData.smtpHost = smtpHost;
  if (smtpPort !== undefined) updateData.smtpPort = smtpPort;
  if (smtpSecure !== undefined) updateData.smtpSecure = smtpSecure;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (isDefault !== undefined) updateData.isDefault = isDefault;
  if (syncEnabled !== undefined) updateData.syncEnabled = syncEnabled;

  const updated = await prisma.emailAccount.update({
    where: { id: accountId },
    data: updateData
  });

  return mapEmailAccountResponse(updated);
}

/**
 * Delete an email account
 */
export async function deleteEmailAccount(accountId, userId, tenantId) {
  const existing = await prisma.emailAccount.findFirst({
    where: {
      id: accountId,
      userId,
      ...(tenantId ? { tenantId } : {})
    }
  });

  if (!existing) {
    throw new AppError("Email account not found", 404);
  }

  await prisma.emailAccount.delete({
    where: { id: accountId }
  });

  return { success: true, message: "Email account deleted successfully" };
}

/**
 * Update OAuth tokens for an email account
 */
export async function updateEmailAccountTokens(accountId, userId, tenantId, tokens) {
  const { accessToken, refreshToken, expiresAt } = tokens;

  // Internal token-refresh calls pass userId/tenantId as null — only scope
  // by them when actually provided, otherwise the lookup can never match.
  const existing = await prisma.emailAccount.findFirst({
    where: {
      id: accountId,
      ...(userId ? { userId } : {}),
      ...(tenantId ? { tenantId } : {})
    }
  });

  if (!existing) {
    throw new AppError("Email account not found", 404);
  }

  const updated = await prisma.emailAccount.update({
    where: { id: accountId },
    data: {
      accessToken: encrypt(accessToken),
      refreshToken: refreshToken ? encrypt(refreshToken) : existing.refreshToken,
      tokenExpiresAt: expiresAt
    }
  });

  return mapEmailAccountResponse(updated);
}

/**
 * Get decrypted tokens for an email account (internal use)
 */
export async function getEmailAccountTokens(accountId) {
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
    select: {
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true
    }
  });

  if (!account) {
    throw new AppError("Email account not found", 404);
  }

  return {
    accessToken: account.accessToken ? decrypt(account.accessToken) : null,
    refreshToken: account.refreshToken ? decrypt(account.refreshToken) : null,
    expiresAt: account.tokenExpiresAt
  };
}

/**
 * Update sync status for an email account
 */
export async function updateEmailAccountSyncStatus(accountId, status, error = null) {
  await prisma.emailAccount.update({
    where: { id: accountId },
    data: {
      lastSyncedAt: new Date(),
      lastSyncStatus: status,
      syncError: error
    }
  });
}

/**
 * Get all active email accounts for sync (worker use)
 */
export async function getActiveEmailAccountsForSync() {
  const accounts = await prisma.emailAccount.findMany({
    where: {
      isActive: true,
      syncEnabled: true,
      accessToken: { not: null }
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          tenantId: true
        }
      }
    }
  });

  return accounts.map(account => ({
    ...mapEmailAccountResponse(account),
    user: account.user
  }));
}

/**
 * Map email account to response object (without sensitive data)
 */
function mapEmailAccountResponse(account) {
  return {
    id: account.id,
    userId: account.userId,
    tenantId: account.tenantId,
    provider: account.provider,
    email: account.email,
    displayName: account.displayName,
    hasAccessToken: !!account.accessToken,
    hasRefreshToken: !!account.refreshToken,
    tokenExpiresAt: account.tokenExpiresAt,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapSecure: account.imapSecure,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    smtpSecure: account.smtpSecure,
    isActive: account.isActive,
    isDefault: account.isDefault,
    syncEnabled: account.syncEnabled,
    lastSyncedAt: account.lastSyncedAt,
    lastSyncStatus: account.lastSyncStatus,
    syncError: account.syncError,
    metadata: account.metadata,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

export { EMAIL_PROVIDERS, DEFAULT_IMAP_CONFIG, DEFAULT_SMTP_CONFIG };
