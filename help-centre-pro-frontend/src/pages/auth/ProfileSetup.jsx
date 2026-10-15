import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Circle,
  Clock3,
  Globe2,
  Languages,
  Users,
} from "lucide-react";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import PremiumSelect from "../../components/auth/PremiumSelect.jsx";
import { completeProfile, getVerificationStatus } from "../../api/auth.api.js";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  LANGUAGES,
  TIMEZONES,
  normalizeLanguageCode,
} from "../../constants/profileOptions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  isProviderUser,
  needsCompanyDetails,
  rememberOnboardedAccount,
} from "../../utils/onboarding.js";
import "../../styles/auth.css";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const email = location.state?.email || user?.email || "";

  const [form, setForm] = useState({
    companyName: "",
    website: "",
    language: "en",
    timezone: "Africa/Lagos",
    industry: "Retail & E-commerce",
    companySize: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [gateChecking, setGateChecking] = useState(Boolean(email));

  useEffect(() => {
    let cancelled = false;

    async function gate() {
      if (!email) {
        navigate("/signup", { replace: true });
        return;
      }

      // Google / already-authenticated users can complete company details directly.
      if (user?.email && user.email === email && user.emailVerified !== false) {
        if (isProviderUser(user)) {
          navigate("/admin/overview", { replace: true });
          return;
        }
        if (!needsCompanyDetails(user)) {
          rememberOnboardedAccount(user.email);
          navigate("/dashboard", { replace: true });
          return;
        }
        if (user.language) {
          const code = normalizeLanguageCode(user.language);
          setForm((prev) => ({ ...prev, language: code }));
          i18n.changeLanguage(code);
          localStorage.setItem("language", code);
        }
        if (!cancelled) setGateChecking(false);
        return;
      }

      try {
        const result = await getVerificationStatus(email);
        const data = result?.data;
        if (cancelled) return;

        if (!data?.verified) {
          navigate("/check-email", {
            replace: true,
            state: { email, purpose: "verify" },
          });
          return;
        }

        if (data.profileCompleted) {
          rememberOnboardedAccount(email);
          navigate("/login", {
            replace: true,
            state: { email, verified: true },
          });
          return;
        }

        if (data.language) {
          const code = normalizeLanguageCode(data.language);
          setForm((prev) => ({ ...prev, language: code }));
          i18n.changeLanguage(code);
          localStorage.setItem("language", code);
        }
      } catch {
        if (!cancelled) {
          navigate("/check-email", {
            replace: true,
            state: { email, purpose: "verify" },
          });
        }
      } finally {
        if (!cancelled) setGateChecking(false);
      }
    }

    gate();
    return () => {
      cancelled = true;
    };
  }, [email, navigate, i18n, user]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "language") {
      const code = normalizeLanguageCode(value);
      i18n.changeLanguage(code);
      localStorage.setItem("language", code);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.companyName.trim() || form.companyName.trim().length < 2) {
      setError(t("auth.profileSetup.errors.companyName"));
      return;
    }
    if (!form.timezone || !form.industry || !form.language || !form.companySize) {
      setError(t("auth.profileSetup.errors.required"));
      return;
    }

    setSubmitting(true);
    try {
      const language = normalizeLanguageCode(form.language);
      await completeProfile({
        email,
        companyName: form.companyName.trim(),
        website: form.website.trim() || undefined,
        timezone: form.timezone,
        industry: form.industry,
        language,
        companySize: form.companySize,
      });

      i18n.changeLanguage(language);
      localStorage.setItem("language", language);
      rememberOnboardedAccount(email);

      if (user) {
        await refreshUser();
        navigate("/dashboard", { replace: true });
        return;
      }

      navigate("/login", {
        replace: true,
        state: { email, profileCompleted: true },
      });
    } catch (err) {
      setError(err.message || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (gateChecking) {
    return (
      <div className="company-page">
        <div className="company-card">
          <BrandLogo compact />
          <p className="company-loading">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="company-page">
      <div className="company-card">
        <BrandLogo compact />
        <h1 className="company-title">{t("auth.profileSetup.title")}</h1>

        <form className="company-form" onSubmit={handleSubmit} noValidate>
          {error ? <p className="auth-error">{error}</p> : null}

          <label className="company-row" htmlFor="company-name">
            <span className="company-row__icon company-row__icon--accent">
              <Circle size={10} fill="currentColor" strokeWidth={0} />
            </span>
            <span className="company-row__field">
              <span className="company-row__label">{t("auth.profileSetup.companyName")}</span>
              <input
                id="company-name"
                type="text"
                value={form.companyName}
                onChange={(e) => setField("companyName", e.target.value)}
                placeholder={t("auth.profileSetup.companyNamePlaceholder")}
                autoComplete="organization"
                required
              />
            </span>
          </label>

          <label className="company-row" htmlFor="company-website">
            <span className="company-row__icon">
              <Globe2 size={16} />
            </span>
            <span className="company-row__field">
              <span className="company-row__label">{t("auth.profileSetup.website")}</span>
              <input
                id="company-website"
                type="text"
                value={form.website}
                onChange={(e) => setField("website", e.target.value)}
                placeholder={t("auth.profileSetup.websitePlaceholder")}
                autoComplete="url"
              />
            </span>
          </label>

          <div className="company-row">
            <span className="company-row__icon">
              <Languages size={16} />
            </span>
            <span className="company-row__field">
              <span className="company-row__label">{t("auth.profileSetup.language")}</span>
              <PremiumSelect
                id="company-language"
                value={form.language}
                onChange={(value) => setField("language", value)}
                options={LANGUAGES.map((lang) => ({
                  value: lang.code,
                  label: lang.label,
                }))}
                placeholder={t("auth.profileSetup.selectLanguage")}
                required
              />
            </span>
          </div>

          <div className="company-row">
            <span className="company-row__icon">
              <Clock3 size={16} />
            </span>
            <span className="company-row__field">
              <span className="company-row__label">{t("auth.profileSetup.timezone")}</span>
              <PremiumSelect
                id="company-timezone"
                value={form.timezone}
                onChange={(value) => setField("timezone", value)}
                options={TIMEZONES}
                placeholder={t("auth.profileSetup.selectTimezone")}
                required
              />
            </span>
          </div>

          <div className="company-row">
            <span className="company-row__icon">
              <Building2 size={16} />
            </span>
            <span className="company-row__field">
              <span className="company-row__label">{t("auth.profileSetup.industry")}</span>
              <PremiumSelect
                id="company-industry"
                value={form.industry}
                onChange={(value) => setField("industry", value)}
                options={INDUSTRIES}
                placeholder={t("auth.profileSetup.selectIndustry")}
                required
              />
            </span>
          </div>

          <div className="company-row">
            <span className="company-row__icon">
              <Users size={16} />
            </span>
            <span className="company-row__field">
              <span className="company-row__label">{t("auth.profileSetup.companySize")}</span>
              <PremiumSelect
                id="company-size"
                value={form.companySize}
                onChange={(value) => setField("companySize", value)}
                options={COMPANY_SIZES}
                placeholder={t("auth.profileSetup.selectCompanySize")}
                required
              />
            </span>
          </div>

          <button
            className={`company-cta${submitting ? " company-cta--loading" : ""}`}
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? (
              <>
                <span className="auth-btn__spinner" aria-hidden="true" />
                {t("common.loading")}
              </>
            ) : (
              t("auth.profileSetup.continue")
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
