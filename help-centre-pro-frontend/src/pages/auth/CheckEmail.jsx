import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PaperPlaneIcon from "../../components/auth/PaperPlaneIcon.jsx";
import { getVerificationStatus } from "../../api/auth.api.js";
import "../../styles/auth.css";

export default function CheckEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const checkingRef = useRef(false);

  const email = location.state?.email || "";
  const purpose = location.state?.purpose || "verify";
  const [verified, setVerified] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  const checkStatus = useCallback(async () => {
    if (!email || purpose === "reset" || checkingRef.current) return null;

    checkingRef.current = true;
    try {
      const result = await getVerificationStatus(email);
      const isVerified = Boolean(result?.data?.verified);
      setVerified(isVerified);
      setMustChangePassword(Boolean(result?.data?.mustChangePassword));
      return result?.data || null;
    } catch {
      return null;
    } finally {
      checkingRef.current = false;
    }
  }, [email, purpose]);

  useEffect(() => {
    if (!email || purpose === "reset") return undefined;

    checkStatus();
    const interval = setInterval(checkStatus, 2500);
    return () => clearInterval(interval);
  }, [email, purpose, checkStatus]);

  useEffect(() => {
    if (!verified || purpose === "reset") return;
    if (mustChangePassword) {
      setHint("Email verified. Finish setup from the link in your email.");
      return;
    }
    navigate("/login", {
      replace: true,
      state: { email, verified: true },
    });
  }, [verified, mustChangePassword, purpose, navigate, email]);

  async function handleContinue() {
    setHint("");
    setBusy(true);

    try {
      if (purpose === "reset") {
        setHint("Open the link in your email to create your new password.");
        return;
      }

      if (!email) {
        setHint("Missing email. Please sign up again.");
        return;
      }

      const status = await checkStatus();
      if (status?.verified && !status?.mustChangePassword) {
        navigate("/login", {
          replace: true,
          state: { email, verified: true },
        });
        return;
      }

      if (status?.verified && status?.mustChangePassword) {
        setHint("Open the verification link in your email to create your password.");
        return;
      }

      setHint("Please open the verification link in your email first.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="verify-page">
      <div className="verify-card">
        <PaperPlaneIcon />
        <h1 className="verify-heading">Verify Email Address</h1>
        <p className="verify-copy">
          A verification link has been sent to your email address
        </p>
        <p className="verify-email">{email || "your email address"}</p>
        <button
          className="verify-btn"
          type="button"
          onClick={handleContinue}
          disabled={busy}
        >
          Continue
        </button>
        {hint ? <p className="verify-hint">{hint}</p> : null}
      </div>
    </div>
  );
}
