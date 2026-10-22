import { apiRequest } from "./client.js";

/**
 * Email Accounts API — connected mailboxes (OAuth or app-password IMAP/SMTP)
 * for two-way email sync between HelpCentre Pro and the agent's mailbox.
 */

export const emailAccountsApi = {
  list: () => apiRequest("/email-accounts", { auth: true }),

  getDefault: () => apiRequest("/email-accounts/default", { auth: true }),

  get: (accountId) => apiRequest(`/email-accounts/${accountId}`, { auth: true }),

  create: (data) =>
    apiRequest("/email-accounts", { method: "POST", auth: true, body: data }),

  update: (accountId, data) =>
    apiRequest(`/email-accounts/${accountId}`, {
      method: "PUT",
      auth: true,
      body: data,
    }),

  delete: (accountId) =>
    apiRequest(`/email-accounts/${accountId}`, { method: "DELETE", auth: true }),

  getOAuthUrl: (provider, state = null) =>
    apiRequest(
      `/email-accounts/oauth/${provider}/auth-url${state ? `?state=${encodeURIComponent(state)}` : ""}`,
      { auth: true }
    ),

  handleOAuthCallback: (provider, code, state = null) =>
    apiRequest(`/email-accounts/oauth/${provider}/callback`, {
      method: "POST",
      auth: true,
      body: { code, state },
    }),

  testImap: (accountId) =>
    apiRequest(`/email-accounts/${accountId}/test-imap`, {
      method: "POST",
      auth: true,
    }),

  testSmtp: (accountId) =>
    apiRequest(`/email-accounts/${accountId}/test-smtp`, {
      method: "POST",
      auth: true,
    }),

  getFolders: (accountId) =>
    apiRequest(`/email-accounts/${accountId}/folders`, { auth: true }),

  syncAccount: (accountId) =>
    apiRequest(`/email-accounts/${accountId}/sync`, {
      method: "POST",
      auth: true,
    }),

  syncAll: () =>
    apiRequest("/email-accounts/sync-all", { method: "POST", auth: true }),

  getWorkerStats: () =>
    apiRequest("/email-accounts/worker/stats", { auth: true }),

  getProvidersStatus: () =>
    apiRequest("/email-accounts/providers/status", { auth: true }),
};

export default emailAccountsApi;
