import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { emailAccountsApi } from "../../api/email-accounts.api.js";

/**
 * OAuth return page for Gmail / Outlook mailbox connect.
 * Google/Microsoft redirect here with ?code=… — we exchange it with the
 * backend, then return the agent to Email Accounts.
 */
export default function EmailOAuthCallback() {
  const { provider } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("working");
  const [message, setMessage] = useState("Connecting your mailbox…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setStatus("error");
      setMessage(`Sign-in was cancelled or denied (${oauthError}).`);
      return;
    }
    if (!code) {
      setStatus("error");
      setMessage("No authorization code returned. Please try connecting again.");
      return;
    }

    (async () => {
      try {
        await emailAccountsApi.handleOAuthCallback(
          provider,
          code,
          searchParams.get("state")
        );
        setStatus("done");
        setMessage("Mailbox connected! Two-way sync is now live.");
        setTimeout(() => navigate("/workspace/email-settings"), 1400);
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Unable to finish connecting your mailbox.");
      }
    })();
  }, [provider, searchParams, navigate]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          padding: 32,
          border: "1px solid #e4e7ec",
          borderRadius: 16,
          background: "#fff",
        }}
      >
        {status === "working" ? (
          <Loader2 size={36} className="ws-spin" style={{ color: "#7a5af8" }} />
        ) : status === "done" ? (
          <CheckCircle2 size={36} style={{ color: "#027a48" }} />
        ) : (
          <XCircle size={36} style={{ color: "#b42318" }} />
        )}
        <h2 style={{ margin: "14px 0 6px", fontSize: 18 }}>
          {status === "done"
            ? "Mailbox connected"
            : status === "error"
              ? "Connection failed"
              : "Connecting mailbox"}
        </h2>
        <p style={{ color: "#667085", fontSize: 14, margin: 0 }}>{message}</p>
        {status === "error" ? (
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 16 }}
            onClick={() => navigate("/workspace/email-settings")}
          >
            Back to Email Accounts
          </button>
        ) : null}
      </div>
    </div>
  );
}
