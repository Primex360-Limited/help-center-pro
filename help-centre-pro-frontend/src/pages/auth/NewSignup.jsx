import { useState } from "react";
import { Eye, EyeOff, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import { registerWorkspace } from "../../api/auth.api.js";
import { needsCompanyDetails } from "../../utils/onboarding.js";
import signupHero from "../../assets/signup-hero.png";
import "../../styles/auth.css";

export default function NewSignup() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          <BrandLogo size="sm" />

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

            <button
              className="auth-btn signup-cta"
              type="submit"
              disabled={submitting}
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
