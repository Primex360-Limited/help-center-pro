import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "../api/auth.api.js";
import { clearStoredAuth, getStoredToken } from "../api/client.js";
import { normalizeLanguageCode } from "../constants/profileOptions.js";
import i18n from "../i18n/config.js";
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
      clearStoredAuth();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email, password, options = {}) => {
    const { portal, tenantId, tenantSlug, ...rest } = options;
    const result = await authApi.login(
      {
        email,
        password,
        ...(tenantId ? { tenantId } : {}),
        ...(tenantSlug ? { tenantSlug } : {}),
        ...rest,
      },
      portal ? { portal } : {}
    );
    const nextUser = normalizeUser(result?.data?.user);
    setUser(nextUser);
    rememberOnboardingState(nextUser);
    applyUserLanguage(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission) => {
      if (!user || !permission) return false;
      // Provider platform operators only — tenant roles never bypass RBAC.
      if (user.isSuperAdmin && (user.userType === "provider" || user.user_type === "provider")) {
        return true;
      }
      return (user.permissions || []).includes(permission);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (permissions = []) => {
      if (!Array.isArray(permissions) || permissions.length === 0) return false;
      return permissions.some((key) => hasPermission(key));
    },
    [hasPermission]
  );

  // Re-hydrate access when the tab regains focus so role edits take effect
  // without forcing a full logout.
  useEffect(() => {
    function syncAccess() {
      if (!getStoredToken()) return;
      if (document.visibilityState && document.visibilityState !== "visible") return;
      refreshUser();
    }

    window.addEventListener("focus", syncAccess);
    document.addEventListener("visibilitychange", syncAccess);
    return () => {
      window.removeEventListener("focus", syncAccess);
      document.removeEventListener("visibilitychange", syncAccess);
    };
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshUser,
      hasPermission,
      hasAnyPermission,
      canManageUsers: hasAnyPermission([
        "agent:read",
        "agent:invite",
        "role:read",
        "role:manage",
      ]),
      canManageRoles: hasAnyPermission(["role:read", "role:manage"]),
      canManageSettings: hasAnyPermission(["settings:read", "settings:write"]),
    }),
    [user, loading, login, logout, refreshUser, hasPermission, hasAnyPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
