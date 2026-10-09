import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PasswordField from "../../components/auth/PasswordField.jsx";
import PasswordRequirements from "../../components/auth/PasswordRequirements.jsx";
import { updatePassword } from "../../api/auth.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { isPasswordValid } from "../../utils/password.js";
import "../../styles/auth.css";

export default function ChangePassword() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!isPasswordValid(newPassword)) {
      setError("Please meet all password requirements");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to update password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page-light" style={{ placeItems: "center" }}>
      <div className="auth-card auth-card--wide auth-card--bordered">
        <h1 className="auth-title">Create and Confirm your new Password</h1>
        <p className="auth-subtitle">Your data is safe and secure with us</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <p className="auth-error">{error}</p> : null}

          <PasswordField
            id="current-password"
            label="Current Password"
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            bordered
          />

          <PasswordField
            id="new-password"
            label="Create Password"
            placeholder="Create Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            bordered
            autoComplete="new-password"
          />

          <PasswordRequirements password={newPassword} />

          <PasswordField
            id="confirm-new-password"
            label="Confirm Password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            bordered
            autoComplete="new-password"
          />

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}