import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

export default function ProtectedRoute({ children, permission }) {
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
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user?.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
