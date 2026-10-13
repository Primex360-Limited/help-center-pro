import { useState } from "react";
import { ChevronRight, Lock, Shield } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/auth.css";
import "../../styles/admin.css";

export default function AdminLogin() {
  const { login, logout, isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchEmail =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("email")
      : "";
  const [email, setEmail] = useState(location.state?.email || searchEmail || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice] = useState(location.state?.notice || "");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated && (user?.isSuperAdmin || user?.userType === "provider")) {
    return <Navigate to="/admin/overview" replace />;
  }

  if (!loading && isAuthenticated && user?.userType === "tenant") {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <BrandLogo />
          <div className="admin-login-badge-row">
            <span className="admin-login-badge">
              <Shield size={12} />
              Access denied
            </span>
          </div>
          <h1 className="auth-title">Administrators only</h1>
          <p className="auth-subtitle">
            Workspace accounts cannot access the Admin Portal. Sign in through your
            workspace application instead.
          </p>
          <button
            className="auth-btn"
            type="button"
            onClick={async () => {
              await logout();
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const nextUser = await login(email.trim(), password);
      if (!(nextUser?.isSuperAdmin || nextUser?.userType === "provider")) {
        await logout();
        setError("This portal is for HelpCentre Pro platform administrators only.");
        return;
      }
      if (nextUser?.mustChangePassword) {
        navigate("/change-password");
        return;
      }
      navigate("/admin/overview");
    } catch (err) {
      setError(err.message || "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <BrandLogo />
        <div className="admin-login-badge-row">
          <span className="admin-login-badge">
            <Shield size={12} />
            Platform Admin
          </span>
        </div>
        <h1 className="auth-title">Admin Sign In</h1>
        <p className="auth-subtitle">
          Secure access to the HelpCentre Pro platform control centre.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {notice ? <p className="auth-success">{notice}</p> : null}
          {error ? <p className="auth-error">{error}</p> : null}

          <div>
            <label className="auth-label" htmlFor="admin-email">
              Email Address
            </label>
            <input
              id="admin-email"
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <PasswordField
            id="admin-password"
            label="Password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <div className="auth-forgot">
            <Link className="auth-link" to="/forgot-password">
              Forgot password?
            </Link>
          </div>

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign In"}
            {!submitting ? <ChevronRight size={18} /> : null}
          </button>
        </form>

        <div className="admin-login-secure-note">
          <Lock size={14} />
          <span>
            Administrators are provisioned inside the platform. Credentials can be
            updated after sign-in from account security.
          </span>
        </div>
      </div>
    </div>
  );
}
