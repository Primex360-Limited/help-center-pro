import { apiRequest } from "./client.js";

/** Workspace API keys (test / live). */
export async function getApiKeys() {
  return apiRequest("/workspace/api-keys", { auth: true });
}

export async function regenerateTestApiKey() {
  return apiRequest("/workspace/api-keys/test/regenerate", {
    method: "POST",
    auth: true,
  });
}

export async function regenerateLiveApiKey() {
  return apiRequest("/workspace/api-keys/live/regenerate", {
    method: "POST",
    auth: true,
  });
}

/** Outbound webhook configuration. */
export async function getWebhookSettings() {
  return apiRequest("/workspace/webhooks", { auth: true });
}

export async function updateWebhookSettings(payload) {
  return apiRequest("/workspace/webhooks", {
    method: "PUT",
    auth: true,
    body: payload,
  });
}

/** Billing / plan + Paystack checkout. */
export async function getBillingStatus() {
  return apiRequest("/workspace/billing", { auth: true });
}

/** Plans are embedded in GET /workspace/billing — no separate endpoint. */
export async function getBillingPlans() {
  return getBillingStatus();
}

export async function initializeBillingUpgrade(payload = {}) {
  return apiRequest("/workspace/billing/paystack/initialize", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

export async function verifyBillingPayment(payload) {
  return apiRequest("/workspace/billing/paystack/verify", {
    method: "POST",
    auth: true,
    body: payload,
  });
}
