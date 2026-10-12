import { useState } from "react";
import { ChevronRight, Shield } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/auth.css";
import "../../styles/admin.css";

export default function AdminLogin() {
  const { login, isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated && (user?.isSuperAdmin || user?.userType === "provider")) {
    return <Navigate to="/admin/overview" replace />;
  }

  if (!loading && isAuthenticated && user?.userType === "tenant") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const nextUser = await login(email.trim(), password);
      if (!(nextUser?.isSuperAdmin || nextUser?.userType === "provider")) {
        setError("This portal is for HelpCentre Pro platform administrators only.");
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
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span className="admin-login-badge">
            <Shield size={12} />
            Platform Admin
          </span>
        </div>
        <h1 className="auth-title">Admin Sign In</h1>
        <p className="auth-subtitle">
          Access the HelpCentre Pro platform control centre.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
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

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign In"}
            {!submitting ? <ChevronRight size={18} /> : null}
          </button>
        </form>
      </div>
    </div>
  );
}
