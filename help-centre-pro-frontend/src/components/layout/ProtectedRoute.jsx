import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminLoginPath, tenantLoginPath } from "../../config/env.js";
import { isProviderUser, needsCompanyDetails } from "../../utils/onboarding.js";

export default function ProtectedRoute({
  children,
  permission,
  /** Pass when any one of several permissions should grant access. */
  anyOfPermissions,
  providerOnly = false,
  tenantOnly = false,
}) {
  const { loading, isAuthenticated, user, hasPermission } = useAuth();
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
    return (
      <Navigate
        to={isProviderUser(user) ? "/admin/overview" : "/dashboard"}
        replace
      />
    );
  }

  return children;
}
