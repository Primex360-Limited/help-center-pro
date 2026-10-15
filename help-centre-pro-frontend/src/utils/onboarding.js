/**
 * Onboarding rules shared by every sign-in surface.
 *
 * A user supplies the company details exactly once — during signup. After that
 * the "Company details" screen must never appear again, so `Login`,
 * `ProtectedRoute` and `ProfileSetup` all resolve that question here instead of
 * comparing the raw `profileCompleted` flag on their own.
 */

const ONBOARDED_ACCOUNTS_KEY = "hcp_onboarded_accounts";

export function isProviderUser(user) {
  return Boolean(user?.isSuperAdmin || user?.userType === "provider");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function readOnboardedAccounts() {
  try {
    const raw = localStorage.getItem(ONBOARDED_ACCOUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Remember that this account already finished onboarding on this browser.
 * Purely a safety net: the server flag stays authoritative.
 */
export function rememberOnboardedAccount(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  try {
    const accounts = readOnboardedAccounts();
    if (accounts.includes(normalized)) return;

    const next = [...accounts, normalized].slice(-25);
    localStorage.setItem(ONBOARDED_ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    /* Storage unavailable (private mode) — the server flag still governs. */
  }
}

export function hasOnboardedBefore(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return readOnboardedAccounts().includes(normalized);
}

/**
 * `true` only when the workspace still needs its company details AND the
 * account has never onboarded on this browser. Everyone else goes straight to
 * the dashboard.
 */
export function needsCompanyDetails(user) {
  if (!user || isProviderUser(user)) return false;
  if (user.profileCompleted !== false) return false;
  return !hasOnboardedBefore(user.email);
}
