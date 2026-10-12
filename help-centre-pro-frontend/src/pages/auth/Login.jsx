import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/auth.css";

export default function Login() {
  const { login, isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice] = useState(location.state?.notice || "");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    const isProvider = user?.isSuperAdmin || user?.userType === "provider";
    return <Navigate to={isProvider ? "/admin/overview" : "/dashboard"} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const nextUser = await login(email.trim(), password);
      if (nextUser?.mustChangePassword) {
        navigate("/change-password");
      } else if (nextUser?.isSuperAdmin || nextUser?.userType === "provider") {
        navigate("/admin/overview");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message || "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page-dark">
      <div className="auth-card">
        <BrandLogo />
        <h1 className="auth-title auth-title--center">Welcome Back</h1>
        <p className="auth-subtitle auth-subtitle--center">
          Log into your HelpCentre Pro account.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {notice ? <p className="auth-success">{notice}</p> : null}
          {error ? <p className="auth-error">{error}</p> : null}

          <div>
            <label className="auth-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <PasswordField
            id="login-password"
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

        <div className="auth-footer-pill">
          <span>
            Do you need an account? <Link to="/signup">Sign up</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
