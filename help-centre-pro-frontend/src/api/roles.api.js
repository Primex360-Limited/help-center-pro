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

export async function getRole(id) {
  return apiRequest(`/roles/${id}`, { auth: true });
}

export async function updateRole(id, payload) {
  return apiRequest(`/roles/${id}`, {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

