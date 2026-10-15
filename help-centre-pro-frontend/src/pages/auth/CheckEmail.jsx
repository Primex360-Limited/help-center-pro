import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PaperPlaneIcon from "../../components/auth/PaperPlaneIcon.jsx";
import { getVerificationStatus } from "../../api/auth.api.js";
import { normalizeLanguageCode } from "../../constants/profileOptions.js";
import i18n from "../../i18n/config.js";
import "../../styles/auth.css";

export default function CheckEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const checkingRef = useRef(false);

  const email = location.state?.email || "";
  const purpose = location.state?.purpose || "verify";
  const [verified, setVerified] = useState(Boolean(location.state?.verified));
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  const checkStatus = useCallback(async () => {
    if (!email || purpose === "reset" || checkingRef.current) return null;

    checkingRef.current = true;
    try {
      const result = await getVerificationStatus(email);
      const data = result?.data || null;
      const isVerified = Boolean(data?.verified);
      setVerified(isVerified);
      setMustChangePassword(Boolean(data?.mustChangePassword));
      setProfileCompleted(Boolean(data?.profileCompleted));

      if (data?.language) {
        const code = normalizeLanguageCode(data.language);
        i18n.changeLanguage(code);
        localStorage.setItem("language", code);
      }

      return data;
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

  async function handleContinue() {
    setHint("");
    setBusy(true);

    try {
      if (purpose === "reset") {
        setHint(t("auth.checkEmail.openResetLink"));
        return;
      }

      if (!email) {
        setHint(t("auth.checkEmail.missingEmail"));
        return;
      }

      const status = await checkStatus();
      const isVerified = Boolean(status?.verified || verified);

      if (!isVerified) {
        setHint(t("auth.checkEmail.verifyFirst"));
        return;
      }

      if (status?.mustChangePassword || mustChangePassword) {
        setHint(t("auth.checkEmail.openInviteLink"));
        return;
      }

      if (status?.profileCompleted || profileCompleted) {
        navigate("/login", {
          replace: true,
          state: { email, verified: true },
        });
        return;
      }

      navigate("/profile-setup", {
        replace: true,
        state: { email, verified: true },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="verify-page">
      <div className="verify-card">
        <PaperPlaneIcon />
        <h1 className="verify-heading">{t("auth.checkEmail.title")}</h1>
        <p className="verify-copy">{t("auth.checkEmail.subtitle")}</p>
        <p className="verify-email">{email || t("auth.checkEmail.yourEmail")}</p>
        <button
          className="verify-btn"
          type="button"
          onClick={handleContinue}
          disabled={busy}
        >
          {busy ? t("common.loading") : t("auth.checkEmail.continue")}
        </button>
        {hint ? <p className="verify-hint">{hint}</p> : null}
        {verified && purpose !== "reset" ? (
          <p className="verify-ready">{t("auth.checkEmail.ready")}</p>
        ) : null}
      </div>
    </div>
  );
}
