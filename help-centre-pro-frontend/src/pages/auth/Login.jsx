import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { isTenantPortal } from "../../config/env.js";
import "../../styles/auth.css";

export default function Login() {
  const { login, loginWithGoogle, logout, isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice] = useState(location.state?.notice || "");
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [clearingProvider, setClearingProvider] = useState(false);

  function routeAfterAuth(nextUser) {
    const isProvider =
      nextUser?.isSuperAdmin || nextUser?.userType === "provider";

    if (isProvider && isTenantPortal) {
      return "provider-blocked";
    }
    if (nextUser?.mustChangePassword) {
      navigate("/change-password");
      return "ok";
    }
    if (isProvider) {
      navigate("/admin/overview");
      return "ok";
    }
    if (nextUser?.profileCompleted === false) {
      navigate("/profile-setup", {
        replace: true,
        state: { email: nextUser.email || email.trim(), verified: true },
      });
      return "ok";
    }
    navigate("/dashboard");
    return "ok";
  }

  useEffect(() => {
    if (loading || !isAuthenticated || !isTenantPortal) return;
    const isProvider = user?.isSuperAdmin || user?.userType === "provider";
    if (!isProvider || clearingProvider) return;

    setClearingProvider(true);
    (async () => {
      await logout();
      setError(
        "Platform administrator accounts cannot sign in here. Use the Admin Portal."
      );
      setClearingProvider(false);
    })();
  }, [loading, isAuthenticated, user, logout, clearingProvider]);

  if (!loading && isAuthenticated) {
    const isProvider = user?.isSuperAdmin || user?.userType === "provider";
    if (isProvider && isTenantPortal) {
      return (
        <div className="auth-page-dark">
          <div className="auth-card">
            <BrandLogo />
            <p className="auth-subtitle auth-subtitle--center">Securing session…</p>
          </div>
        </div>
      );
    }
    if (!isProvider && user?.profileCompleted === false) {
      return (
        <Navigate
          to="/profile-setup"
          replace
          state={{ email: user.email, verified: true }}
        />
      );
    }
    return <Navigate to={isProvider ? "/admin/overview" : "/dashboard"} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const nextUser = await login(email.trim(), password);
      const routed = routeAfterAuth(nextUser);
      if (routed === "provider-blocked") {
        await logout();
        setError(
          "Platform administrator accounts cannot sign in here. Use the Admin Portal."
        );
      }
    } catch (err) {
      const message = err.message || "Unable to sign in";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setGoogleBusy(true);
    try {
      const nextUser = await loginWithGoogle();
      const routed = routeAfterAuth(nextUser);
      if (routed === "provider-blocked") {
        await logout();
        setError(
          "Platform administrator accounts cannot sign in here. Use the Admin Portal."
        );
      }
    } catch (err) {
      if (err?.code === "auth/popup-closed-by-user") return;
      setError(err.message || "Unable to sign in with Google");
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="auth-page-dark">
      <div className="auth-card">
        <BrandLogo />
        <h1 className="auth-title auth-title--center">Welcome Back</h1>
        <p className="auth-subtitle auth-subtitle--center">
          Log into your HelpCentre Pro workspace.
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

          <button className="auth-btn" type="submit" disabled={submitting || googleBusy}>
            {submitting ? "Signing in..." : "Sign In"}
            {!submitting ? <ChevronRight size={18} /> : null}
          </button>

          <div className="signup-or" style={{ marginTop: 4 }}>
            <span>Or</span>
          </div>

          <button
            type="button"
            className="signup-google"
            onClick={handleGoogle}
            disabled={submitting || googleBusy}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" />
            </svg>
            {googleBusy ? "Connecting..." : "Continue with Google"}
          </button>
        </form>

        <div className="auth-footer-pill">
          <span>
            {/invitation email|create your password/i.test(error) ? (
              <>
                Have an invite? Check your email for the activation link.
              </>
            ) : (
              <>
                Don&apos;t have an account? <Link to="/signup">Sign up</Link>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
