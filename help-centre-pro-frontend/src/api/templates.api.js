import { apiRequest } from "./client.js";

/** Message templates CRUD. */
export async function listTemplates() {
  return apiRequest("/templates", { auth: true });
}

export async function createTemplate(payload) {
  return apiRequest("/templates", { method: "POST", auth: true, body: payload });
}

export async function updateTemplate(templateId, payload) {
  return apiRequest(`/templates/${encodeURIComponent(templateId)}`, {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

export async function deleteTemplate(templateId) {
  return apiRequest(`/templates/${encodeURIComponent(templateId)}`, {
    method: "DELETE",
    auth: true,
  });
}
