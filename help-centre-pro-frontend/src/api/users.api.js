import { apiRequest } from "./client.js";

export async function listUsers({ includeStats = false } = {}) {
  const query = includeStats ? "?includeStats=true" : "";
  return apiRequest(`/users${query}`, { auth: true });
}

export async function getUser(id) {
  return apiRequest(`/users/${id}`, { auth: true });
}

export async function updateUser(id, payload) {
  return apiRequest(`/users/${id}`, {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

export async function deleteUser(id) {
  return apiRequest(`/users/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function activateUser(id) {
  return apiRequest(`/users/${id}`, {
    method: "PATCH",
    auth: true,
    body: { status: "active" },
  });
}

export async function deactivateUser(id) {
  return apiRequest(`/users/${id}`, {
    method: "PATCH",
    auth: true,
    body: { status: "inactive" },
  });
}

export async function suspendUser(id) {
  return apiRequest(`/users/${id}`, {
    method: "PATCH",
    auth: true,
    body: { status: "suspended" },
  });
}
