import { apiRequest } from "./client.js";

/** Workspace automation rules CRUD. */
export async function listAutomationRules() {
  return apiRequest("/automations", { auth: true });
}

export async function getAutomationRule(ruleId) {
  return apiRequest(`/automations/${encodeURIComponent(ruleId)}`, { auth: true });
}

export async function createAutomationRule(payload) {
  return apiRequest("/automations", { method: "POST", auth: true, body: payload });
}

export async function updateAutomationRule(ruleId, payload) {
  return apiRequest(`/automations/${encodeURIComponent(ruleId)}`, {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

export async function deleteAutomationRule(ruleId) {
  return apiRequest(`/automations/${encodeURIComponent(ruleId)}`, {
    method: "DELETE",
    auth: true,
  });
}
