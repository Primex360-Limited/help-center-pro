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

const AuthContext = createContext(null);

function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    id: user.id || user._id,
    roleName: user.role?.name || user.roleId?.name || null,
    permissions: user.allowedPermissions || user.permissions || [],
    isSuperAdmin: Boolean(user.isSuperAdmin),
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
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
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
      logout,
      refreshUser,
      hasPermission,
      canManageUsers: hasPermission("manage_users"),
      canManageRoles: hasPermission("manage_roles"),
    }),
    [user, loading, login, logout, refreshUser, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
