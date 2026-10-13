import { API_BASE, API_URL, PORTAL_MODE } from "../config/env.js";

const TOKEN_KEY = "hcp_access_token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = false,
    headers = {},
  } = options;

  const portalHeader =
    PORTAL_MODE === "admin" ? "admin" : PORTAL_MODE === "tenant" ? "tenant" : "combined";

  const finalHeaders = {
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    "X-Portal": portalHeader,
    ...headers,
  };

  if (auth) {
    const token = getStoredToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: finalHeaders,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      `Unable to reach the API (${API_URL}). Confirm the backend is live and CORS allows this site.`
    );
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
