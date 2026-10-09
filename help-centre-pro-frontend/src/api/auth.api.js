import { apiRequest, setStoredToken } from "./client.js";

export async function registerSuperAdmin(payload) {
  return apiRequest("/auth/register-super-admin", {
    method: "POST",
    body: payload,
  });
}

export async function login(payload) {
  const result = await apiRequest("/auth/login", {
    method: "POST",
    body: payload,
  });

  if (result?.data?.accessToken) {
    setStoredToken(result.data.accessToken);
  }

  return result;
}

export async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "POST", auth: true });
  } finally {
    setStoredToken(null);
  }
}

export async function getMe() {
  return apiRequest("/auth/me", { auth: true });
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
