import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import AuthBackLink from "../../components/auth/AuthBackLink.jsx";
import "../../styles/auth.css";

function extractInviteToken(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    return url.searchParams.get("token") || "";
  } catch {
    return value;
  }
}

export default function WorkspaceSignup() {
  const navigate = useNavigate();
  const [inviteInput, setInviteInput] = useState("");
  const [error, setError] = useState("");

  const previewToken = useMemo(
    () => extractInviteToken(inviteInput),
    [inviteInput]
  );

  function handleContinue(event) {
    event.preventDefault();
    setError("");

    const token = extractInviteToken(inviteInput);
    if (!token) {
      setError("Paste the invitation link or token from your email to continue.");
      return;
    }

    navigate(`/accept-invitation?token=${encodeURIComponent(token)}`);
  }

  return (
    <div className="auth-page-dark">
      <div className="auth-card auth-card--wide">
        <AuthBackLink to="/login" />
        <BrandLogo />
        <div className="auth-eyebrow">
          <Sparkles size={12} />
          Workspace access
        </div>
        <h1 className="auth-title auth-title--center">Create your account</h1>
        <p className="auth-subtitle auth-subtitle--center">
          HelpCentre Pro workspaces are invitation-only. Use the secure link from
          your admin to activate your account in moments.
        </p>

        <form className="auth-form" onSubmit={handleContinue}>
          {error ? <p className="auth-error">{error}</p> : null}

          <div>
            <label className="auth-label" htmlFor="invite-input">
              Invitation link or token
            </label>
            <input
              id="invite-input"
              className="auth-input"
              value={inviteInput}
              onChange={(event) => setInviteInput(event.target.value)}
              placeholder="Paste invitation URL or token"
              autoComplete="off"
              required
            />
            {previewToken && inviteInput.includes("http") ? (
              <p className="auth-hint">Invitation token detected and ready.</p>
            ) : null}
          </div>

          <button className="auth-btn" type="submit">
            Continue to activation
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-signup-panel">
          <div className="auth-signup-panel__icon">
            <Mail size={18} />
          </div>
          <div>
            <p className="auth-signup-panel__title">No invitation yet?</p>
            <p className="auth-signup-panel__copy">
              Ask your workspace administrator to invite you. Once the email
              arrives, return here or open the link directly.
            </p>
          </div>
        </div>

        <div className="auth-footer-pill">
          <span>
            Already activated? <Link to="/login">Sign in</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
