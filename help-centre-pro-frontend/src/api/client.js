import { API_BASE, API_URL, PORTAL_MODE } from "../config/env.js";

const TOKEN_KEY = "hcp_access_token";
const REFRESH_KEY = "hcp_refresh_token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setStoredRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_KEY, token);
  else localStorage.removeItem(REFRESH_KEY);
}

export function clearStoredAuth() {
  setStoredToken(null);
  setStoredRefreshToken(null);
}

let refreshInFlight = null;

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getStoredRefreshToken();
    const headers = {
      "Content-Type": "application/json",
      "X-Portal":
        PORTAL_MODE === "admin"
          ? "admin"
          : PORTAL_MODE === "tenant"
            ? "tenant"
            : "combined",
    };

    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      clearStoredAuth();
      return null;
    }

    const accessToken = payload?.data?.accessToken;
    const nextRefresh = payload?.data?.refreshToken;
    if (accessToken) setStoredToken(accessToken);
    if (nextRefresh) setStoredRefreshToken(nextRefresh);
    return accessToken || null;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = false,
    headers = {},
    timeoutMs = 0,
    _retried = false,
  } = options;

  const portalHeader =
    PORTAL_MODE === "admin" ? "admin" : PORTAL_MODE === "tenant" ? "tenant" : "combined";

  const finalHeaders = {
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    "X-Portal": portalHeader,
    ...headers,
  };

  if (auth) {
    let token = getStoredToken();
    if (!token && !_retried) {
      token = await refreshAccessToken();
    }
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer =
    timeoutMs > 0 && controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: finalHeaders,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(
        "The request timed out. Email sending may be blocked on this host — reconnect Gmail with Google sign-in, then try again."
      );
    }
    const target = API_URL || window.location.origin;
    throw new Error(
      `Unable to reach the API (${target}). Confirm the backend is live on port 4008 and CORS allows this site.`
    );
  } finally {
    if (timer) clearTimeout(timer);
  }

  // Expired/missing access token — refresh once and retry.
  if (
    auth &&
    !_retried &&
    response.status === 401 &&
    path !== "/auth/refresh" &&
    path !== "/auth/login"
  ) {
    const renewed = await refreshAccessToken();
    if (renewed) {
      return apiRequest(path, { ...options, _retried: true });
    }
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

    if (
      response.status === 401 &&
      /authorization token is required|invalid or expired access token/i.test(
        String(message)
      )
    ) {
      message = "Your session expired. Please sign in again and retry.";
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
