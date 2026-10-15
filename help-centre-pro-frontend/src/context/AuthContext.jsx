import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "../api/auth.api.js";
import { getStoredToken, setStoredToken } from "../api/client.js";
import { normalizeLanguageCode } from "../constants/profileOptions.js";
import i18n from "../i18n/config.js";
import { signInWithGooglePopup, signOutFirebase } from "../lib/firebase.js";
import { rememberOnboardedAccount } from "../utils/onboarding.js";

const AuthContext = createContext(null);

function applyUserLanguage(user) {
  if (!user?.language) return;
  const code = normalizeLanguageCode(user.language);
  if (i18n.language !== code) {
    i18n.changeLanguage(code);
  }
  localStorage.setItem("language", code);
  document.documentElement.lang = code;
  document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
}

/**
 * Keep the browser's onboarding memory in sync with the server flag so a
 * returning user is never sent through the "Company details" step again.
 */
function rememberOnboardingState(user) {
  if (user?.profileCompleted === true) {
    rememberOnboardedAccount(user.email);
  }
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    id: user.id || user._id,
    userType: user.userType || user.user_type || null,
    roleName: user.role?.name || user.roleId?.name || null,
    permissions: user.allowedPermissions || user.permissions || [],
    isSuperAdmin: Boolean(user.isSuperAdmin || user.is_super_admin),
    language: user.language ? normalizeLanguageCode(user.language) : null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getStoredToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const result = await authApi.getMe();
      const nextUser = normalizeUser(result?.data?.user);
      setUser(nextUser);
      rememberOnboardingState(nextUser);
      applyUserLanguage(nextUser);
      return nextUser;
    } catch {
      setStoredToken(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    const result = await authApi.login({ email, password });
    const nextUser = normalizeUser(result?.data?.user);
    setUser(nextUser);
    rememberOnboardingState(nextUser);
    applyUserLanguage(nextUser);
    return nextUser;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const google = await signInWithGooglePopup();
    const result = await authApi.googleAuth(google.idToken);
    const nextUser = normalizeUser(result?.data?.user);
    if (result?.data?.needsProfileSetup) {
      nextUser.profileCompleted = false;
    } else {
      rememberOnboardingState(nextUser);
    }
    setUser(nextUser);
    applyUserLanguage(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    await signOutFirebase();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission) => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return (user.permissions || []).includes(permission);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      loginWithGoogle,
      logout,
      refreshUser,
      hasPermission,
      canManageUsers:
        hasPermission("agent:read") || hasPermission("agent:invite"),
      canManageRoles: hasPermission("role:read") || hasPermission("role:manage"),
      canManageSettings:
        hasPermission("settings:read") || hasPermission("settings:write"),
    }),
    [user, loading, login, loginWithGoogle, logout, refreshUser, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
