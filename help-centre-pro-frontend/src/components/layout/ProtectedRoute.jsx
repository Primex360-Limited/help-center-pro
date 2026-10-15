import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminLoginPath, tenantLoginPath } from "../../config/env.js";

function isProviderUser(user) {
  return Boolean(user?.isSuperAdmin || user?.userType === "provider");
}

export default function ProtectedRoute({
  children,
  permission,
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
    !isProviderUser(user) &&
    user?.profileCompleted === false &&
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

  if (permission && !hasPermission(permission)) {
    return (
      <Navigate
        to={isProviderUser(user) ? "/admin/overview" : "/dashboard"}
        replace
      />
    );
  }

  return children;
}
