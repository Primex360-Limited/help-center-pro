import { apiRequest } from "./client.js";

export async function getHowtoContent() {
  return apiRequest("/platform/howto", { auth: true });
}

/**
 * Provider Super Admin only — tenant admins receive 403.
 * Tries PUT first, then POST (alias) if the host rejects PUT.
 */
export async function updateHowtoContent(payload) {
  try {
    return await apiRequest("/admin/howto", {
      method: "PUT",
      auth: true,
      body: payload,
    });
  } catch (err) {
    const msg = String(err?.message || "");
    const missingPut =
      err?.status === 404 ||
      /cannot put/i.test(msg) ||
      /not found/i.test(msg);
    if (!missingPut) throw err;
    return apiRequest("/admin/howto", {
      method: "POST",
      auth: true,
      body: payload,
    });
  }
}
