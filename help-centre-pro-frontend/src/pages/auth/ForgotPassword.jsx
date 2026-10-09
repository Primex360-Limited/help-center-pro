import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthBackLink from "../../components/auth/AuthBackLink.jsx";
import { forgotPassword } from "../../api/auth.api.js";
import "../../styles/auth.css";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await forgotPassword(email.trim());

      navigate("/check-email", {
        state: {
          email: email.trim(),
          purpose: "reset",
          emailSent: result?.data?.emailSent !== false,
        },
      });
    } catch (err) {
      if (err.status === 503 || err.status === 502) {
        navigate("/check-email", {
          state: {
            email: email.trim(),
            purpose: "reset",
            emailSent: false,
          },
        });
        return;
      }
      setError(err.message || "Unable to continue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page-light">
      <AuthBackLink to="/login" />
      <div className="auth-card auth-card--bordered">
        <h1 className="auth-title">Forgot Password</h1>
        <p className="auth-subtitle">Start by providing your email address</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <p className="auth-error">{error}</p> : null}

          <div>
            <label className="auth-label" htmlFor="forgot-email">
              Enter Email
            </label>
            <input
              id="forgot-email"
              className="auth-input auth-input--bordered"
              type="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
