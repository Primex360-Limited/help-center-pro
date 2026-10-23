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
    const target = API_URL || window.location.origin;
    throw new Error(
      `Unable to reach the API (${target}). Confirm the backend is live on port 4008 and CORS allows this site.`
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
    let message =
      payload?.message ||
      payload?.error ||
      `Request failed (${response.status})`;

    if (typeof message === "string") {
      message = sanitizeApiErrorMessage(message, response.status);
    }

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

/**
 * Never surface gateway/proxy HTML (Render 502 pages, Express dumps, CSS
 * @font-face blobs) inside auth forms.
 */
function sanitizeApiErrorMessage(raw, status) {
  const text = String(raw || "");
  const looksLikeHtmlOrCss =
    /<\s*!?\s*doctype|<\s*html|<\s*body|@font-face|font-family:\s*["']Roobert|Bad Gateway|Powered by/i.test(
      text
    ) ||
    text.length > 400;

  if (!looksLikeHtmlOrCss) {
    return text.trim() || `Request failed (${status})`;
  }

  if (status === 502 || status === 503 || status === 504 || /Bad Gateway/i.test(text)) {
    return "The API is waking up or temporarily unavailable. Wait about a minute and try again.";
  }

  const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (plain && plain.length <= 200 && !/@font-face|data:font/i.test(plain)) {
    return plain;
  }

  return `Request failed (${status}). Please try again shortly.`;
}
