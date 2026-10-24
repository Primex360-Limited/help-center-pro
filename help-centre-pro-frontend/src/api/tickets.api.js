import { API_BASE } from "../config/env.js";
import { apiRequest, getStoredToken } from "./client.js";

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function getDashboardOverview() {
  return apiRequest("/tickets/dashboard", {
    method: "GET",
    auth: true,
  });
}

/**
 * GET /tickets — supports status, priority, assignedToUserId, channel, page, limit.
 * Response: { data: { tickets }, meta }
 */
export async function listTickets(params = {}) {
  return apiRequest(`/tickets${toQuery(params)}`, {
    method: "GET",
    auth: true,
  });
}

/**
 * POST /tickets
 * Response: { data: { ticket } }
 */
export async function createTicket(payload) {
  return apiRequest("/tickets", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

/**
 * GET /tickets/:ticketId
 * Response: { data: { ticket } }
 */
export async function getTicket(ticketId) {
  return apiRequest(`/tickets/${encodeURIComponent(ticketId)}`, {
    method: "GET",
    auth: true,
  });
}

/**
 * PATCH /tickets/:ticketId/assign
 * Body: { assignedToUserId }
 */
export async function assignTicket(ticketId, assignedToUserId) {
  return apiRequest(`/tickets/${encodeURIComponent(ticketId)}/assign`, {
    method: "PATCH",
    auth: true,
    body: { assignedToUserId },
  });
}

/**
 * PATCH /tickets/:ticketId/transfer
 * Body: { assignedToUserId, transferReason, priority?, notifyCustomer?, addInternalNote?, keepAsFollower? }
 */
export async function transferTicket(ticketId, payload) {
  return apiRequest(`/tickets/${encodeURIComponent(ticketId)}/transfer`, {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

/**
 * GET /tickets/agents/assignable — all assignable agents with presence + load.
 */
export async function getAssignableAgents() {
  return apiRequest("/tickets/agents/assignable", {
    method: "GET",
    auth: true,
  });
}

/**
 * PATCH /tickets/:ticketId/status
 * Body: { status } — OPEN | PENDING | WAITING_FOR_REPLY | RESOLVED | CLOSED | …
 */
export async function updateTicketStatus(ticketId, status) {
  return apiRequest(`/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: "PATCH",
    auth: true,
    body: { status },
  });
}

/**
 * PATCH /tickets/:ticketId/priority
 * Body: { priority } — LOW | MEDIUM | HIGH
 */
export async function updateTicketPriority(ticketId, priority) {
  return apiRequest(`/tickets/${encodeURIComponent(ticketId)}/priority`, {
    method: "PATCH",
    auth: true,
    body: { priority },
  });
}

/**
 * GET /tickets/:ticketId/messages
 * Response: { data: { messages }, meta }
 */
export async function getMessages(ticketId, params = {}) {
  return apiRequest(
    `/tickets/${encodeURIComponent(ticketId)}/messages${toQuery(params)}`,
    {
      method: "GET",
      auth: true,
    }
  );
}

/**
 * POST /tickets/:ticketId/messages
 * Body: { content } (min length 1)
 * Response: { data: { message } }
 */
export async function sendMessage(ticketId, content) {
  return apiRequest(`/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: "POST",
    auth: true,
    body: { content },
  });
}

/**
 * GET /tickets/:ticketId/internal-notes
 * Response: { data: { messages }, meta }
 */
export async function getInternalNotes(ticketId, params = {}) {
  return apiRequest(
    `/tickets/${encodeURIComponent(ticketId)}/internal-notes${toQuery(params)}`,
    {
      method: "GET",
      auth: true,
    }
  );
}

/**
 * POST /tickets/:ticketId/internal-notes
 * Body: { content }
 */
export async function addInternalNote(ticketId, content) {
  return apiRequest(
    `/tickets/${encodeURIComponent(ticketId)}/internal-notes`,
    {
      method: "POST",
      auth: true,
      body: { content },
    }
  );
}

/**
 * POST /tickets/:ticketId/email/reply
 * Body: { body, toEmail?, subject?, html? }
 */
export async function replyTicketEmail(ticketId, payload) {
  return apiRequest(
    `/tickets/${encodeURIComponent(ticketId)}/email/reply`,
    {
      method: "POST",
      auth: true,
      body: payload,
    }
  );
}

/**
 * GET /tickets/:ticketId/thread
 * Response: { data: { thread } } or { data: thread[] }
 */
export async function getTicketThread(ticketId) {
  return apiRequest(`/tickets/${encodeURIComponent(ticketId)}/thread`, {
    method: "GET",
    auth: true,
  });
}

/**
 * GET /tickets/agents/online
 * Response: { data: { agents } } — agents: { userId, name, email, role, isOnline }
 */
export async function getOnlineAgents() {
  return apiRequest("/tickets/agents/online", {
    method: "GET",
    auth: true,
  });
}

/** Softphone readiness for the tenant's active VoIP/SIP provider. */
export async function getVoiceToken() {
  return apiRequest("/tickets/voice/token", {
    method: "GET",
    auth: true,
  });
}

/**
 * Start an outbound call ticket, then connect via browser SIP softphone.
 * Body: { to, ticketId?, customerName?, customerEmail?, title?, defaultRegion? }
 */
export async function placeOutboundCall(payload) {
  return apiRequest("/tickets/voice/outbound", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

/**
 * Log an inbound SIP call answered in the browser softphone.
 */
export async function startInboundSipCall(payload) {
  return apiRequest("/tickets/voice/inbound", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

/**
 * Complete a SIP call on the ticket (duration / status / recording URL).
 */
export async function completeSipCall(payload) {
  return apiRequest("/tickets/voice/complete", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

/**
 * Fetch call recording as a Blob when the ticket stores a public HTTPS URL.
 */
export async function fetchTicketRecordingBlob(ticketId) {
  const token = getStoredToken();
  const response = await fetch(
    `${API_BASE}/tickets/voice/recordings/${encodeURIComponent(ticketId)}`,
    {
      method: "GET",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  if (!response.ok) {
    throw new Error("Unable to download recording");
  }
  return response.blob();
}
