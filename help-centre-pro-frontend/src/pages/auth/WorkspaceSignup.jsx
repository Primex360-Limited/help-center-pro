import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import { registerWorkspace } from "../../api/auth.api.js";
import "../../styles/auth.css";

export default function WorkspaceSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(key) {
    return (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerWorkspace({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      const emailSent = result?.data?.emailSent !== false;

      navigate("/login", {
        replace: true,
        state: {
          email: form.email.trim(),
          notice: emailSent
            ? "Account created. A welcome email is on its way — you can sign in now."
            : "Account created successfully. You can sign in now.",
        },
      });
    } catch (err) {
      setError(err.message || "Unable to create account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page-dark">
      <div className="auth-card auth-card--signup">
        <BrandLogo compact />
        <h1 className="auth-title auth-title--center">Create your account</h1>
        <p className="auth-subtitle auth-subtitle--center">
          Start your HelpCentre Pro account.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <p className="auth-error">{error}</p> : null}

          <div>
            <label className="auth-label" htmlFor="signup-fullname">
              Full name
            </label>
            <input
              id="signup-fullname"
              className="auth-input"
              value={form.fullName}
              onChange={updateField("fullName")}
              placeholder="Name"
              autoComplete="name"
              required
            />
          </div>

          <div>
            <label className="auth-label" htmlFor="signup-email">
              Work email
            </label>
            <input
              id="signup-email"
              className="auth-input"
              type="email"
              value={form.email}
              onChange={updateField("email")}
              placeholder="Email"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <PasswordField
              id="signup-password"
              label="Password"
              placeholder="Password"
              value={form.password}
              onChange={updateField("password")}
              autoComplete="new-password"
            />
            <p className="auth-password-hint">At least 8 characters</p>
          </div>

          <PasswordField
            id="signup-confirm"
            label="Confirm Password"
            placeholder="Password"
            value={form.confirmPassword}
            onChange={updateField("confirmPassword")}
            autoComplete="new-password"
          />

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
            {!submitting ? <ChevronRight size={18} /> : null}
          </button>
        </form>

        <div className="auth-footer-pill">
          <span>
            Already have an account? <Link to="/login">Sign in</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
