import { apiRequest } from "./client.js";

export async function listRoles() {
  return apiRequest("/roles/all", { auth: true });
}

export async function createRole(payload) {
  return apiRequest("/roles", {
    method: "POST",
    auth: true,
    body: payload,
  });
}
