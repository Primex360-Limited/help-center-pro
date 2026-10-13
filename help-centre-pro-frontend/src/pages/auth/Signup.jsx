import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import PasswordRequirements from "../../components/auth/PasswordRequirements.jsx";
import { registerSuperAdmin } from "../../api/auth.api.js";
import { isPasswordValid } from "../../utils/password.js";
import "../../styles/auth.css";

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

  function updateField(key) {
    return (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
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
      <div className="auth-card auth-card--wide">
        <BrandLogo />
        <h1 className="auth-title auth-title--center">Create your account</h1>
        <p className="auth-subtitle auth-subtitle--center">
          Set up the first HelpCentre Pro Super Admin.
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
            {submitting ? "Creating account..." : "Create Account"}
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
