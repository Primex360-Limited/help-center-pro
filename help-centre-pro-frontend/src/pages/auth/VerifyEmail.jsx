import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PaperPlaneIcon from "../../components/auth/PaperPlaneIcon.jsx";
import { verifyEmail } from "../../api/auth.api.js";
import "../../styles/auth.css";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
        const profileCompleted = Boolean(result?.data?.profileCompleted);

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

          if (profileCompleted) {
            navigate("/login", {
              replace: true,
              state: { email: verifiedEmail, verified: true },
            });
            return;
          }

          navigate("/check-email", {
            replace: true,
            state: {
              email: verifiedEmail,
              purpose: "verify",
              verified: true,
            },
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
        <h1 className="verify-heading">{t("auth.checkEmail.title")}</h1>

        {status === "verifying" ? (
          <>
            <p className="verify-copy">{t("auth.verify.confirming")}</p>
            <p className="verify-email">{t("auth.verify.pleaseWait")}</p>
          </>
        ) : null}

        {status === "success" ? (
          <>
            <p className="verify-copy">{t("auth.verify.success")}</p>
            <p className="verify-email">{email || t("auth.verify.verified")}</p>
          </>
        ) : null}

        {status === "missing" || status === "error" ? (
          <>
            <p className="verify-copy">
              {status === "missing"
                ? t("auth.verify.incomplete")
                : t("auth.verify.expired")}
            </p>
            <p className="verify-email">{t("auth.verify.requestNew")}</p>
          </>
        ) : null}

        <button
          className="verify-btn"
          type="button"
          disabled={status === "verifying" || status === "success"}
          onClick={() =>
            navigate(email ? "/check-email" : "/signup", {
              replace: true,
              state: email ? { email, purpose: "verify", verified: status === "success" } : undefined,
            })
          }
        >
          {status === "success"
            ? t("auth.verify.continuing")
            : t("auth.verify.back")}
        </button>
      </div>
    </div>
  );
}
