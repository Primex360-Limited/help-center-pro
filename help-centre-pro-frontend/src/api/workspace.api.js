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

/** Get VoIP/SIP provider configurations for the workspace. */
export async function getVoipSettings() {
  return apiRequest("/workspace/voip", { auth: true });
}

/** Save VoIP/SIP provider configurations. */
export async function saveVoipSettings(payload) {
  return apiRequest("/workspace/voip", {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

/** Test connection to a configured VoIP provider. */
export async function testVoipConnection(configId) {
  return apiRequest(`/workspace/voip/test/${configId}`, {
    method: "POST",
    auth: true,
  });
}

/**
 * Ask the backend to find the provider's SIP-over-WebSocket endpoint.
 *
 * Servers can do what a browser cannot: DNS SRV lookups plus TCP/TLS probes of
 * the usual Asterisk/FreeSWITCH/Kamailio ports, each confirmed with a real
 * `101 Switching Protocols` handshake and a browser-trusted certificate. The
 * result is ranked, so the softphone only has to verify a candidate or two.
 */
export async function discoverVoipWebSocket({
  configId = "",
  providerId = "",
  host = "",
  providerDomain = "",
  providerWsUrl = "",
  persist = false,
  force = false,
} = {}) {
  return apiRequest("/workspace/voip/discover-ws", {
    method: "POST",
    auth: true,
    body: {
      configId,
      providerId,
      host,
      providerDomain,
      providerWsUrl,
      persist,
      force,
    },
    timeoutMs: 15000,
  });
}

