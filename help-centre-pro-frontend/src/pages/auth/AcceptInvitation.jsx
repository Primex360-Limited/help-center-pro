import { useEffect, useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import PasswordRequirements from "../../components/auth/PasswordRequirements.jsx";
import { acceptInvitation, previewInvitation } from "../../api/invitations.api.js";
import { isPasswordValid } from "../../utils/password.js";
import "../../styles/auth.css";

export default function AcceptInvitation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [preview, setPreview] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invitation token is missing. Open the link from your invite email.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const result = await previewInvitation(token);
        if (!cancelled) setPreview(result?.data || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Invalid invitation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAccept(event) {
    event.preventDefault();
    setError("");

    if (!isPasswordValid(password)) {
      setError("Please meet all password requirements");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await acceptInvitation(token, password, confirmPassword);
      navigate("/login", {
        replace: true,
        state: {
          email: preview?.email || "",
          notice:
            "Workspace activated. Sign in with the password you just created.",
        },
      });
    } catch (err) {
      setError(err.message || "Unable to accept invitation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page-dark">
      <div className="auth-card auth-card--signup">
        <BrandLogo compact />
        <div className="auth-eyebrow">
          <ShieldCheck size={12} />
          Secure activation
        </div>
        <h1 className="auth-title auth-title--center">Activate your account</h1>
        <p className="auth-subtitle auth-subtitle--center">
          Create your password to finish joining HelpCentre Pro. No temporary
          password needed — you&apos;ll sign in with what you set here.
        </p>

        <form className="auth-form" onSubmit={handleAccept}>
          {loading ? (
            <p className="auth-subtitle" style={{ margin: 0 }}>
              Loading invitation…
            </p>
          ) : null}
          {error ? <p className="auth-error">{error}</p> : null}

          {preview ? (
            <div className="auth-signup-panel" style={{ marginTop: 0 }}>
              <div>
                <p className="auth-signup-panel__title">
                  {preview.firstName} {preview.lastName}
                </p>
                <p className="auth-signup-panel__copy">
                  {preview.email}
                  {preview.role?.name ? ` · ${preview.role.name}` : ""}
                </p>
              </div>
            </div>
          ) : null}

          <PasswordField
            id="invite-password"
            label="Create Password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          <PasswordRequirements password={password} />

          <PasswordField
            id="invite-confirm"
            label="Confirm Password"
            placeholder="Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />

          <button
            className="auth-btn"
            type="submit"
            disabled={!token || loading || submitting || !preview}
          >
            {submitting ? "Activating..." : "Activate & Continue"}
            {!submitting ? <ChevronRight size={18} /> : null}
          </button>
        </form>

        <div className="auth-footer-pill">
          <span>
            Already activated? <Link to="/login">Sign in</Link>
          </span>
        </div>
      </div>
    </div>
  );
}