import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaperPlaneIcon from "../../components/auth/PaperPlaneIcon.jsx";
import { verifyEmail } from "../../api/auth.api.js";
import "../../styles/auth.css";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [status, setStatus] = useState(token ? "verifying" : "missing");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const result = await verifyEmail(token);
        if (cancelled) return;

        const verifiedEmail = result?.data?.email || "";
        const setupToken = result?.data?.passwordSetupToken || "";
        const needsPassword =
          Boolean(result?.data?.requiresPasswordSetup) ||
          Boolean(result?.data?.mustChangePassword);

        setEmail(verifiedEmail);
        setStatus("success");

        window.setTimeout(() => {
          if (cancelled) return;

          if (needsPassword && setupToken) {
            navigate(`/create-password?token=${encodeURIComponent(setupToken)}`, {
              replace: true,
              state: {
                email: verifiedEmail,
                verified: true,
                passwordSetupToken: setupToken,
              },
            });
            return;
          }

          navigate("/login", {
            replace: true,
            state: { email: verifiedEmail, verified: true },
          });
        }, 700);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="verify-page">
      <div className="verify-card">
        <PaperPlaneIcon />
        <h1 className="verify-heading">Verify Email Address</h1>

        {status === "verifying" ? (
          <>
            <p className="verify-copy">Confirming your verification link...</p>
            <p className="verify-email">Please wait</p>
          </>
        ) : null}

        {status === "success" ? (
          <>
            <p className="verify-copy">
              Your email has been verified successfully
            </p>
            <p className="verify-email">{email || "Verified"}</p>
          </>
        ) : null}

        {status === "missing" ? (
          <>
            <p className="verify-copy">
              This verification link is incomplete or invalid
            </p>
            <p className="verify-email">Request a new link to continue</p>
          </>
        ) : null}

        {status === "error" ? (
          <>
            <p className="verify-copy">
              This verification link is invalid or has expired
            </p>
            <p className="verify-email">Request a new link to continue</p>
          </>
        ) : null}

        <button
          className="verify-btn"
          type="button"
          disabled={status === "verifying" || status === "success"}
          onClick={() => navigate("/login")}
        >
          {status === "success" ? "Continuing..." : "Back to Sign In"}
        </button>
      </div>
    </div>
  );
}
