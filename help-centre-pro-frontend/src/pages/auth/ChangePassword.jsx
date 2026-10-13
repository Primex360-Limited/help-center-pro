import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import PasswordRequirements from "../../components/auth/PasswordRequirements.jsx";
import { updatePassword } from "../../api/auth.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminLoginPath, isAdminPortal } from "../../config/env.js";
import { isPasswordValid } from "../../utils/password.js";
import "../../styles/auth.css";
import "../../styles/admin.css";

export default function ChangePassword() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isProvider = Boolean(user?.isSuperAdmin || user?.userType === "provider");
  const useAdminChrome = isAdminPortal || isProvider;

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
      const next = isProvider ? adminLoginPath() : "/login";
      if (next.startsWith("http")) {
        window.location.assign(
          `${next}${next.includes("?") ? "&" : "?"}notice=${encodeURIComponent(
            "Password updated. Sign in with your new credentials."
          )}`
        );
        return;
      }
      navigate(next, {
        replace: true,
        state: { notice: "Password updated. Sign in with your new credentials." },
      });
    } catch (err) {
      setError(err.message || "Unable to update password");
    } finally {
      setSubmitting(false);
    }
  }

  const shellClass = useAdminChrome ? "admin-login-page" : "auth-page-light";
  const cardClass = useAdminChrome
    ? "admin-login-card admin-login-card--wide"
    : "auth-card auth-card--wide auth-card--bordered";

  return (
    <div className={shellClass} style={useAdminChrome ? undefined : { placeItems: "center" }}>
      <div className={cardClass}>
        {useAdminChrome ? <BrandLogo /> : null}
        {useAdminChrome ? (
          <div className="admin-login-badge-row">
            <span className="admin-login-badge">
              <Shield size={12} />
              Account security
            </span>
          </div>
        ) : null}
        <h1 className="auth-title">Update your password</h1>
        <p className="auth-subtitle">
          Choose a strong password to protect your HelpCentre Pro account.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <p className="auth-error">{error}</p> : null}

          <PasswordField
            id="current-password"
            label="Current Password"
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            bordered={!useAdminChrome}
          />

          <PasswordField
            id="new-password"
            label="New Password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            bordered={!useAdminChrome}
            autoComplete="new-password"
          />

          <PasswordRequirements password={newPassword} />

          <PasswordField
            id="confirm-new-password"
            label="Confirm Password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            bordered={!useAdminChrome}
            autoComplete="new-password"
          />

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}
