import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Sparkles } from "lucide-react";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import PasswordRequirements from "../../components/auth/PasswordRequirements.jsx";
import { getPlatformStatus, registerSuperAdmin } from "../../api/auth.api.js";
import { adminLoginPath, isTenantPortal } from "../../config/env.js";
import PortalAccessDenied from "./PortalAccessDenied.jsx";
import { isPasswordValid } from "../../utils/password.js";
import "../../styles/auth.css";
import "../../styles/admin.css";

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (isTenantPortal) {
      setChecking(false);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const result = await getPlatformStatus();
        if (!cancelled) {
          setBootstrapped(Boolean(result?.data?.bootstrapped));
        }
      } catch {
        if (!cancelled) setBootstrapped(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isTenantPortal) {
    return <PortalAccessDenied />;
  }

  function updateField(key) {
    return (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  function goToAdminSignIn(notice, email) {
    const path = adminLoginPath();
    if (path.startsWith("http")) {
      const url = new URL(path);
      if (email) url.searchParams.set("email", email);
      window.location.assign(url.toString());
      return;
    }
    navigate(path, {
      replace: true,
      state: {
        email: email || form.email.trim(),
        notice:
          notice ||
          "Account created. A welcome email is on its way — sign in to the Admin Portal.",
      },
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!isPasswordValid(form.password)) {
      setError("Please meet all password requirements");
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerSuperAdmin({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      const emailSent = result?.data?.emailSent !== false;
      goToAdminSignIn(
        emailSent
          ? "Account created. A welcome email is on its way — sign in to continue."
          : "Account created successfully. Sign in to continue.",
        form.email.trim()
      );
    } catch (err) {
      const message = err.message || "Unable to create account";
      if (/already has an administrator|super admin already exists/i.test(message)) {
        setBootstrapped(true);
        setError("");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <BrandLogo />
          <p className="auth-subtitle auth-subtitle--center">Preparing secure signup…</p>
        </div>
      </div>
    );
  }

  if (bootstrapped) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <BrandLogo />
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span className="admin-login-badge">
              <Shield size={12} />
              Platform ready
            </span>
          </div>
          <h1 className="auth-title">Admin already set up</h1>
          <p className="auth-subtitle">
            This HelpCentre Pro platform already has an administrator. Sign in to
            the Admin Portal to manage tenants and access.
          </p>
          <button
            className="auth-btn"
            type="button"
            onClick={() => goToAdminSignIn("Welcome back — sign in to continue.")}
          >
            Go to Admin Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card admin-login-card--wide">
        <BrandLogo />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span className="admin-login-badge">
            <Sparkles size={12} />
            Platform setup
          </span>
        </div>
        <h1 className="auth-title">Create your Admin account</h1>
        <p className="auth-subtitle">
          Set up the first HelpCentre Pro platform administrator. You’ll receive a
          welcome email and can sign in immediately.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <p className="auth-error">{error}</p> : null}

          <div>
            <label className="auth-label" htmlFor="signup-first">
              First Name
            </label>
            <input
              id="signup-first"
              className="auth-input"
              value={form.firstName}
              onChange={updateField("firstName")}
              placeholder="First name"
              required
            />
          </div>

          <div>
            <label className="auth-label" htmlFor="signup-last">
              Last Name
            </label>
            <input
              id="signup-last"
              className="auth-input"
              value={form.lastName}
              onChange={updateField("lastName")}
              placeholder="Last name"
              required
            />
          </div>

          <div>
            <label className="auth-label" htmlFor="signup-email">
              Email Address
            </label>
            <input
              id="signup-email"
              className="auth-input"
              type="email"
              value={form.email}
              onChange={updateField("email")}
              placeholder="Email"
              required
            />
          </div>

          <PasswordField
            id="signup-password"
            label="Password"
            placeholder="Password"
            value={form.password}
            onChange={updateField("password")}
            autoComplete="new-password"
          />

          <PasswordRequirements password={form.password} />

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? "Creating account..." : "Create Admin Account"}
          </button>
        </form>

        <div className="auth-footer-pill">
          <span>
            Already have an admin account?{" "}
            <Link
              to={adminLoginPath().startsWith("http") ? "#" : adminLoginPath()}
              onClick={(event) => {
                if (adminLoginPath().startsWith("http")) {
                  event.preventDefault();
                  window.location.assign(adminLoginPath());
                }
              }}
            >
              Sign in
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
