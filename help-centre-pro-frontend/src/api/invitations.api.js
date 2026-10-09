import { apiRequest } from "./client.js";

export async function inviteUser(payload) {
  return apiRequest("/invitations", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

export async function previewInvitation(token) {
  return apiRequest(`/invitations/preview?token=${encodeURIComponent(token)}`);
}

export async function acceptInvitation(token) {
  return apiRequest("/invitations/accept", {
    method: "POST",
    body: { token },
  });
}