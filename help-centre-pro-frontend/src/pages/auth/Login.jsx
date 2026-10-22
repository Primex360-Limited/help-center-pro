import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import SignInTransition from "../../components/auth/SignInTransition.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { isTenantPortal } from "../../config/env.js";
import { needsCompanyDetails } from "../../utils/onboarding.js";
import "../../styles/auth.css";

export default function Login() {
  const { login, logout, isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice] = useState(location.state?.notice || "");
  const [submitting, setSubmitting] = useState(false);
  const [clearingProvider, setClearingProvider] = useState(false);
  const [redirecting, setRedirecting] = useState("");
  const redirectTimer = useRef(null);

  useEffect(
    () => () => {
      if (redirectTimer.current) {
        window.clearTimeout(redirectTimer.current);
      }
    },
    []
  );

  function routeAfterAuth(nextUser) {
    const isProvider =
      nextUser?.isSuperAdmin || nextUser?.userType === "provider";

    if (isProvider && isTenantPortal) {
      return "provider-blocked";
    }
    if (nextUser?.mustChangePassword) {
      return "change-password";
    }
    if (isProvider) {
      return "admin";
    }
    if (needsCompanyDetails(nextUser)) {
      return "profile-setup";
    }
    return "dashboard";
  }

  /**
   * Shared post-authentication routing after password sign-in.
   * Returns the destination it routed to, or `"provider-blocked"` so the
   * caller can explain why the session was closed again.
   */
  async function routeSignedInUser(nextUser) {
    const destination = routeAfterAuth(nextUser);

    if (destination === "provider-blocked") {
      await logout();
      setError(
        "Platform administrator accounts cannot sign in here. Use the Admin Portal."
      );
      setSubmitting(false);
      return destination;
    }

    if (destination === "change-password") {
      navigate("/change-password", { replace: true });
      return destination;
    }

    if (destination === "profile-setup") {
      navigate("/profile-setup", {
        replace: true,
        state: { email: nextUser?.email || email.trim(), verified: true },
      });
      return destination;
    }

    const target = destination === "admin" ? "/admin/overview" : "/dashboard";
    setRedirecting(
      destination === "admin"
        ? "Opening the admin portal…"
        : "Loading your dashboard…"
    );
    redirectTimer.current = window.setTimeout(() => {
      navigate(target, { replace: true });
    }, 420);
    return destination;
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
    if (redirecting) {
      return <SignInTransition message={redirecting} />;
    }
    if (needsCompanyDetails(user)) {
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

  if (redirecting) {
    return <SignInTransition message={redirecting} />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const nextUser = await login(email.trim(), password, {
        portal: "tenant",
      });
      const destination = await routeSignedInUser(nextUser);
      if (destination !== "provider-blocked") {
        setSubmitting(false);
      }
    } catch (err) {
      const message = err.message || "Unable to sign in";
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page-dark">
      <div className="auth-card auth-card--signin">
        <BrandLogo size="sm" />
        <h1 className="auth-title auth-title--center">Welcome Back</h1>
        <p className="auth-subtitle auth-subtitle--center">
          Log into your HelpCenter Pro account
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

          <button
            className="auth-btn"
            type="submit"
            disabled={submitting || Boolean(redirecting)}
            aria-busy={submitting}
          >
            {submitting ? (
              <>
                <span className="auth-btn__spinner" aria-hidden="true" />
                Signing you in…
              </>
            ) : (
              <>
                Sign In
                <ChevronRight size={18} strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer-pill">
          <span>
            {/invitation email|create your password/i.test(error) ? (
              <>Have an invite? Check your email for the activation link.</>
            ) : (
              <>
                Do you need an account? <Link to="/signup">Sign up</Link>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
