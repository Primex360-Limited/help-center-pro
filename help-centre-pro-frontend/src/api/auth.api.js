import {
  apiRequest,
  clearStoredAuth,
  setStoredRefreshToken,
  setStoredToken,
} from "./client.js";

export async function getPlatformStatus() {
  return apiRequest("/auth/platform-status", {
    method: "GET",
  });
}

export async function registerSuperAdmin(payload) {
  return apiRequest("/auth/register-super-admin", {
    method: "POST",
    body: payload,
  });
}

export async function registerWorkspace(payload) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: payload,
  });
}

/**
 * `portal` ("admin" | "tenant") pins which identity scope wins when one email
 * exists in both scopes - platform owners keep a workspace row *and* a provider
 * row. The API reads this from the `X-Portal` header (`resolvePreferScope`).
 */
export async function login(payload, { portal } = {}) {
  const result = await apiRequest("/auth/login", {
    method: "POST",
    body: payload,
    ...(portal ? { headers: { "X-Portal": portal } } : {}),
  });

  if (result?.data?.accessToken) {
    setStoredToken(result.data.accessToken);
  }
  if (result?.data?.refreshToken) {
    setStoredRefreshToken(result.data.refreshToken);
  }

  return result;
}

export async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "POST", auth: true });
  } finally {
    clearStoredAuth();
  }
}

export async function getMe() {
  return apiRequest("/auth/me", { auth: true });
}

/** Save the signed-in agent's handset number for outbound call bridging. */
export async function updateMyPhone(phoneNumber) {
  return apiRequest("/auth/me/phone", {
    method: "PATCH",
    auth: true,
    body: { phoneNumber: phoneNumber || null },
  });
}

/** Save the signed-in agent's sender email for outbound customer emails. */
export async function updateMySenderEmail(senderEmail) {
  return apiRequest("/auth/me/sender-email", {
    method: "PATCH",
    auth: true,
    body: { senderEmail: senderEmail || null },
  });
}

export async function verifyEmail(token) {
  return apiRequest("/auth/verify-email", {
    method: "POST",
    body: { token },
  });
}

export async function getVerificationStatus(email) {
  return apiRequest("/auth/verification-status", {
    method: "POST",
    body: { email },
  });
}

export async function resendVerification(email) {
  return apiRequest("/auth/resend-verification", {
    method: "POST",
    body: { email },
  });
}

export async function forgotPassword(email) {
  return apiRequest("/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

export async function resetPassword(payload) {
  return apiRequest("/auth/reset-password", {
    method: "POST",
    body: payload,
  });
}

export async function updatePassword(payload) {
  return apiRequest("/auth/update-password", {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

export async function completeProfile(payload) {
  return apiRequest("/auth/complete-profile", {
    method: "POST",
    body: payload,
  });
}
