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

export async function getPlatformOverview() {
  return apiRequest("/admin/overview", { auth: true });
}

export async function listTenants(params = {}) {
  return apiRequest(`/admin/tenants${toQuery(params)}`, { auth: true });
}

export async function getTenant(id) {
  return apiRequest(`/admin/tenants/${id}`, { auth: true });
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
  const token = getStoredToken();
  const response = await fetch(`${API_BASE}/admin/tenants/export${toQuery(params)}`, {
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
      /* ignore */
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `helpcentre-pro-tenants-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
