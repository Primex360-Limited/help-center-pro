import { Navigate, useLocation } from "react-router-dom";
import { MODULE_ACCESS } from "../../constants/moduleAccess.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminLoginPath, tenantLoginPath } from "../../config/env.js";
import { isProviderUser, needsCompanyDetails } from "../../utils/onboarding.js";

const FALLBACK_ROUTES = [
  { path: "/dashboard", keys: MODULE_ACCESS.dashboard },
  { path: "/tickets", keys: MODULE_ACCESS.tickets },
  { path: "/customers", keys: MODULE_ACCESS.customers },
  { path: "/templates", keys: MODULE_ACCESS.templates },
  { path: "/agents", keys: MODULE_ACCESS.agents },
  { path: "/workspace/profile", keys: MODULE_ACCESS.settings },
  { path: "/workspace/user-management", keys: MODULE_ACCESS.userManagement },
];

function firstAccessiblePath(hasAnyPermission) {
  for (const route of FALLBACK_ROUTES) {
    if (route.keys?.length && hasAnyPermission(route.keys)) {
      return route.path;
    }
  }
  return "/workspace/profile";
}

export default function ProtectedRoute({
  children,
  permission,
  /** Pass when any one of several permissions should grant access. */
  anyOfPermissions,
  providerOnly = false,
  tenantOnly = false,
}) {
  const { loading, isAuthenticated, user, hasPermission, hasAnyPermission } =
    useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-page-light" style={{ placeItems: "center" }}>
        <p className="auth-subtitle">Loading workspace...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    const loginPath = providerOnly ? adminLoginPath() : tenantLoginPath();
    if (loginPath.startsWith("http")) {
      window.location.replace(loginPath);
      return null;
    }
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  if (user?.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (
    !providerOnly &&
    needsCompanyDetails(user) &&
    location.pathname !== "/profile-setup"
  ) {
    return (
      <Navigate
        to="/profile-setup"
        replace
        state={{ email: user.email, verified: true }}
      />
    );
  }

  if (providerOnly && !isProviderUser(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (tenantOnly && isProviderUser(user)) {
    return <Navigate to="/admin/overview" replace />;
  }

  const required = [
    ...(permission ? [permission] : []),
    ...(Array.isArray(anyOfPermissions) ? anyOfPermissions : []),
  ];
  if (
    required.length > 0 &&
    !required.some((key) => hasPermission(key))
  ) {
    if (isProviderUser(user)) {
      return <Navigate to="/admin/overview" replace />;
    }
    const fallback = firstAccessiblePath(hasAnyPermission);
    if (fallback === location.pathname) {
      return (
        <div className="auth-page-light" style={{ placeItems: "center" }}>
          <p className="auth-subtitle">
            Your role does not include access to this area. Ask a workspace
            admin to update your permissions.
          </p>
        </div>
      );
    }
    return <Navigate to={fallback} replace />;
  }

  return children;
}
