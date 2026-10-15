import { useState } from "react";
import { Eye, EyeOff, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import { registerWorkspace } from "../../api/auth.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { isFirebaseConfigured } from "../../lib/firebase.js";
import signupHero from "../../assets/signup-hero.png";
import "../../styles/auth.css";

export default function NewSignup() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { loginWithGoogle } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError(t("auth.signup.errors.name"));
      return;
    }
    if (!email.includes("@")) {
      setError(t("auth.signup.errors.email"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.signup.errors.passwordLength"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.signup.errors.passwordMatch"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerWorkspace({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      const registeredEmail = result?.data?.email || email.trim();

      navigate("/check-email", {
        replace: true,
        state: { email: registeredEmail, purpose: "verify" },
      });
    } catch (err) {
      setError(err.message || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError("");
    if (!isFirebaseConfigured()) {
      setError(t("auth.signup.googleNotConfigured"));
      return;
    }

    setGoogleBusy(true);
    try {
      const nextUser = await loginWithGoogle();
      if (nextUser?.profileCompleted === false) {
        navigate("/profile-setup", {
          replace: true,
          state: { email: nextUser.email, verified: true },
        });
        return;
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err?.code === "auth/popup-closed-by-user") {
        setError("");
        return;
      }
      setError(err.message || t("common.error"));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="signup-split">
      <aside className="signup-split__hero" aria-label="HelpCentre Pro">
        <img
          className="signup-split__hero-art"
          src={signupHero}
          alt="HelpCentre Pro support channels"
          draggable="false"
        />
      </aside>

      <main className="signup-split__panel">
        <div className="signup-split__card">
          <BrandLogo compact showTagline />

          <h1 className="signup-split__title">{t("auth.signup.title")}</h1>
          <p className="signup-split__subtitle">{t("auth.signup.subtitle")}</p>

          <form className="signup-split__form" onSubmit={handleSubmit} noValidate>
            {error ? <p className="auth-error">{error}</p> : null}

            <div>
              <label className="auth-label" htmlFor="signup-name">
                {t("auth.signup.fullName")}
              </label>
              <input
                id="signup-name"
                className="auth-input signup-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("auth.signup.namePlaceholder")}
                autoComplete="name"
                required
              />
            </div>

            <div>
              <label className="auth-label" htmlFor="signup-email">
                {t("auth.signup.workEmail")}
              </label>
              <input
                id="signup-email"
                className="auth-input signup-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.signup.emailPlaceholder")}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="auth-label" htmlFor="signup-password">
                {t("auth.signup.password")}
              </label>
              <div className="signup-input-wrap">
                <input
                  id="signup-password"
                  className="auth-input signup-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.signup.passwordPlaceholder")}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="signup-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="auth-password-hint">{t("auth.signup.passwordHint")}</p>
            </div>

            <div>
              <label className="auth-label" htmlFor="signup-confirm">
                {t("auth.signup.confirmPassword")}
              </label>
              <div className="signup-input-wrap">
                <input
                  id="signup-confirm"
                  className="auth-input signup-input"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.signup.passwordPlaceholder")}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="signup-eye"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="signup-or">
              <span>{t("auth.signup.or")}</span>
            </div>

            <button
              type="button"
              className="signup-google"
              onClick={handleGoogle}
              disabled={googleBusy || submitting}
            >
              <GoogleMark />
              {googleBusy ? t("common.loading") : t("auth.signup.continueGoogle")}
            </button>

            <button
              className="auth-btn signup-cta"
              type="submit"
              disabled={submitting || googleBusy}
            >
              {submitting ? (
                t("common.loading")
              ) : (
                <>
                  {t("auth.signup.createAccount")}
                  <ChevronRight size={18} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          <p className="signup-split__footer">
            {t("auth.signup.alreadyHaveAccount")}{" "}
            <Link to="/login">{t("auth.signup.signIn")}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
