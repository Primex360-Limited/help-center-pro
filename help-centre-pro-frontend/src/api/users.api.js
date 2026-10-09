import { apiRequest } from "./client.js";

export async function listUsers() {
  return apiRequest("/users", { auth: true });
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
