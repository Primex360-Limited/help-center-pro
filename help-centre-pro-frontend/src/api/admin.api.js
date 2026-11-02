import { API_BASE } from "../config/env.js";
import { apiRequest, getStoredToken } from "./client.js";

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

/**
 * Authenticated CSV download. Keeps the bearer token on the request (cookie
 * sessions still work through `credentials: "include"`) and names the file
 * `<prefix>-YYYY-MM-DD.csv` so repeated exports never overwrite each other.
 */
async function downloadCsv(path, prefix) {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Export failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export async function getPlatformOverview() {
  return apiRequest("/admin/overview", { auth: true });
}

export async function listTenants(params = {}) {
  return apiRequest(`/admin/tenants${toQuery(params)}`, { auth: true });
}

export async function getTenant(id) {
  return apiRequest(`/admin/tenants/${id}`, { auth: true });
}

export async function updateTenant(id, payload) {
  return apiRequest(`/admin/tenants/${id}`, {
    method: "PUT",
    auth: true,
    body: payload,
  });
}

export async function inviteTenant(payload) {
  return apiRequest("/admin/tenants", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

export async function deactivateTenant(id, reason) {
  return apiRequest(`/admin/tenants/${id}/deactivate`, {
    method: "POST",
    auth: true,
    body: reason ? { reason } : {},
  });
}

export async function activateTenant(id) {
  return apiRequest(`/admin/tenants/${id}/activate`, {
    method: "POST",
    auth: true,
  });
}

export async function deleteTenant(id) {
  return apiRequest(`/admin/tenants/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function exportTenantsCsv(params = {}) {
  return downloadCsv(`/admin/tenants/export${toQuery(params)}`, "helpcentre-pro-tenants");
}

/* ------------------------------------------------------------------ Billing */

export async function getBilling(params = {}) {
  return apiRequest(`/admin/billing${toQuery(params)}`, { auth: true });
}

export async function updateInvoiceStatus(invoiceId, status) {
  return apiRequest(`/admin/billing/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "PATCH",
    auth: true,
    body: { status },
  });
}

export async function exportBillingCsv(params = {}) {
  return downloadCsv(`/admin/billing/export${toQuery(params)}`, "helpcentre-pro-invoices");
}

/* -------------------------------------------------------------------- Plans */

export async function getPlans() {
  return apiRequest("/admin/plans", { auth: true });
}

export async function updatePlan(planKey, payload) {
  return apiRequest(`/admin/plans/${encodeURIComponent(planKey)}`, {
    method: "PUT",
    auth: true,
    body: payload,
  });
}

/* ---------------------------------------------------------------- Analytics */

export async function getPlatformAnalytics() {
  return apiRequest("/admin/analytics", { auth: true });
}

export async function exportAnalyticsCsv() {
  return downloadCsv("/admin/analytics/export", "helpcentre-pro-analytics");
}

/* -------------------------------------------------------------------- Staff */

export async function getStaff(params = {}) {
  return apiRequest(`/admin/staff${toQuery(params)}`, { auth: true });
}

export async function inviteStaff(payload) {
  return apiRequest("/admin/staff", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

export async function updateStaffMember(userId, payload) {
  return apiRequest(`/admin/staff/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

/* ---------------------------------------------------------------- Audit log */

export async function getAuditLog(params = {}) {
  return apiRequest(`/admin/audit${toQuery(params)}`, { auth: true });
}

export async function exportAuditCsv(params = {}) {
  return downloadCsv(`/admin/audit/export${toQuery(params)}`, "helpcentre-pro-audit-log");
}

