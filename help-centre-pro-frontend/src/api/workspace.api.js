import { apiRequest } from "./client.js";

/** Organisation profile of the signed-in user's workspace (tenant admins). */

export async function getWorkspaceProfile() {
  return apiRequest("/workspace/profile", { auth: true });
}

export async function updateWorkspaceProfile(payload) {
  return apiRequest("/workspace/profile", {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

/** Generate chat-widget API key (shown once). Customers sync via this key. */
export async function generateWidgetApiKey() {
  return apiRequest("/workspace/integrations/widget-api-key", {
    method: "POST",
    auth: true,
  });
}

/** Generate (allocate) a HelpCentre Pro call number for this workspace. */
export async function generateCallNumber() {
  return apiRequest("/workspace/call-number/generate", {
    method: "POST",
    auth: true,
  });
}

/** Pause/resume HCP number or switch to tenant's existing number. */
export async function updateCallingSettings(payload) {
  return apiRequest("/workspace/calling", {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}
