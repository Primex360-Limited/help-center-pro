import { useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import AuthBackLink from "../../components/auth/AuthBackLink.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import PasswordRequirements from "../../components/auth/PasswordRequirements.jsx";
import { resetPassword } from "../../api/auth.api.js";
import { isPasswordValid } from "../../utils/password.js";
import "../../styles/auth.css";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const token = (params.get("token") || location.state?.resetToken || "").trim();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordReady = isPasswordValid(password);

  const helperText = useMemo(() => {
    if (!token) {
      return "Open the reset link from your email to continue.";
    }
    if (password && !passwordReady) {
      return "Finish all password requirements below to continue.";
    }
    if (confirmPassword && !passwordsMatch) {
      return "Passwords must match exactly.";
    }
    return "";
  }, [token, password, passwordReady, confirmPassword, passwordsMatch]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("Reset token is missing. Request a new password reset link.");
      return;
    }

    if (!isPasswordValid(password)) {
      setError("Password must be at least 8 characters and include uppercase, lowercase, number, and special character.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({
        token,
        password,
        confirmPassword,
      });
      navigate("/login", {
        replace: true,
        state: {
          notice: "Password updated successfully. Sign in to continue.",
        },
      });
    } catch (err) {
      setError(err.message || "Unable to reset password. Request a fresh link and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page-light create-password-page">
      <AuthBackLink to="/forgot-password" circled />
      <div className="auth-card auth-card--wide auth-card--bordered create-password-card">
        <h1 className="auth-title create-password-title">
          Create and Confirm your new Password
        </h1>
        <p className="auth-subtitle">Your data is safe and secure with us</p>

        <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
          {error ? <p className="auth-error">{error}</p> : null}
          {!error && helperText ? <p className="auth-hint">{helperText}</p> : null}

          {!token ? (
            <p className="auth-error">
              No reset token found. Go back and request a password reset again.
            </p>
          ) : null}

          <PasswordField
            id="create-password"
            label="Create Password"
            placeholder="Create Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            bordered
            autoComplete="new-password"
          />

          <PasswordRequirements password={password} />

          <PasswordField
            id="confirm-password"
            label="Confirm Password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            bordered
            autoComplete="new-password"
          />

          <button
            className="auth-btn"
            type="submit"
            disabled={submitting || !token}
          >
            {submitting ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
