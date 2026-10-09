import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthBackLink from "../../components/auth/AuthBackLink.jsx";
import { acceptInvitation, previewInvitation } from "../../api/invitations.api.js";
import "../../styles/auth.css";

export default function AcceptInvitation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invitation token is missing");
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

  async function handleAccept() {
    setSubmitting(true);
    setError("");
    try {
      await acceptInvitation(token);
      setSuccess(
        "Invitation accepted. Sign in with the temporary password from your invite email."
      );
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.message || "Unable to accept invitation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page-light">
      <AuthBackLink to="/login" circled />
      <div className="auth-card auth-card--bordered">
        <h1 className="auth-title">Accept Invitation</h1>
        <p className="auth-subtitle">
          Activate your HelpCentre Pro workspace access.
        </p>

        <div className="auth-form">
          {loading ? <p className="auth-subtitle">Loading invitation...</p> : null}
          {error ? <p className="auth-error">{error}</p> : null}
          {success ? <p className="auth-success">{success}</p> : null}

          {preview ? (
            <div style={{ display: "grid", gap: 8 }}>
              <p className="auth-subtitle" style={{ margin: 0 }}>
                Invited as{" "}
                <strong>
                  {preview.firstName} {preview.lastName}
                </strong>
              </p>
              <p className="auth-subtitle" style={{ margin: 0 }}>
                Email: <strong>{preview.email}</strong>
              </p>
              <p className="auth-subtitle" style={{ margin: 0 }}>
                Role: <strong>{preview.role?.name || "Team member"}</strong>
              </p>
            </div>
          ) : null}

          <button
            className="auth-btn"
            type="button"
            onClick={handleAccept}
            disabled={!token || loading || submitting || Boolean(success)}
          >
            {submitting ? "Activating..." : "Accept & Continue"}
          </button>

          <Link className="auth-link" to="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
