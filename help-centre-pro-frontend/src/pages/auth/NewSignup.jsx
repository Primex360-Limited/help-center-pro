import { useState } from "react";
import { Eye, EyeOff, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { registerWorkspace } from "../../api/auth.api.js";
import heroArt from "../../assets/signup-hero-exact.png";
import logoMark from "../../assets/helpcentre-pro-mark-blue.png";
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
        state: {
          email: registeredEmail,
          purpose: "verify",
          platformOwner: Boolean(result?.data?.platformOwner),
        },
      });
    } catch (err) {
      setError(err.message || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="signup-page">
      <aside className="signup-hero" aria-hidden="true">
        <img
          src={heroArt}
          alt=""
          className="signup-hero__art"
          width={1833}
          height={1930}
        />
      </aside>

      <main className="signup-form-container">
        <div className="signup-form-card">
          <div className="signup-brand">
            <img src={logoMark} alt="" className="signup-brand__mark" />
            <span className="signup-brand__name">Help Center Pro</span>
          </div>

          <h1 className="signup-form-title">Create your account</h1>
          <p className="signup-form-subtitle">
            Start your Help Center Pro account.
          </p>

          <form className="signup-form" onSubmit={handleSubmit} noValidate>
            {error ? <p className="auth-error">{error}</p> : null}

            <div className="signup-form-field">
              <label className="signup-form-label" htmlFor="signup-name">
                Full name
              </label>
              <input
                id="signup-name"
                className="signup-form-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Name"
                autoComplete="name"
                required
              />
            </div>

            <div className="signup-form-field">
              <label className="signup-form-label" htmlFor="signup-email">
                Work email
              </label>
              <input
                id="signup-email"
                className="signup-form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                required
              />
            </div>

            <div className="signup-form-field">
              <label className="signup-form-label" htmlFor="signup-password">
                Password
              </label>
              <div className="signup-form-input-wrap">
                <input
                  id="signup-password"
                  className="signup-form-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="signup-form-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              <p className="signup-form-hint">At least 8 characters</p>
            </div>

            <div className="signup-form-field">
              <label className="signup-form-label" htmlFor="signup-confirm">
                Confirm Password
              </label>
              <div className="signup-form-input-wrap">
                <input
                  id="signup-confirm"
                  className="signup-form-input"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="signup-form-eye"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            <button
              className="signup-form-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                "Creating account..."
              ) : (
                <>
                  Create account <ChevronRight size={18} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          <p className="signup-form-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
