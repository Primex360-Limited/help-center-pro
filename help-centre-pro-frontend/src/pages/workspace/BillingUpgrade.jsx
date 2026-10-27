import { useCallback, useEffect, useState } from "react";
import { Check, CheckCircle2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getBillingPlans,
  initializeBillingUpgrade,
} from "../../api/settings.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/settings-premium.css";

const FREE_FEATURES = [
  "Up to 3 agents",
  "Email and live chat tickets",
  "Basic reporting",
  "Community support",
];

const PREMIUM_FEATURES = [
  "Unlimited agents",
  "Every channel in one inbox",
  "Automations and templates",
  "API access and webhooks",
  "Priority support",
];

export default function BillingUpgrade() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const canWrite = hasPermission("settings:write");

  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getBillingPlans();
      const billing = res?.data?.billing || res?.data || res || {};
      const priceUsd = billing.premiumPriceMonthlyUsd ?? 49;
      setPlans({
        premiumPrice: priceUsd,
        currentPlan: billing.plan || "free",
      });
    } catch (err) {
      setError(err.message || "Failed to load plans");
      setPlans({ premiumPrice: 49, currentPlan: "free" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpgrade() {
    if (!canWrite || upgrading) return;
    setUpgrading(true);
    setError("");
    setBanner("");
    try {
      const email = user?.email;
      if (!email) {
        throw new Error("Your account needs an email address to upgrade.");
      }
      const res = await initializeBillingUpgrade({ email });
      const data = res?.data || {};
      const authorizationUrl = data.authorization_url || data.authorizationUrl;
      if (authorizationUrl) {
        window.location.assign(authorizationUrl);
        return;
      }
      throw new Error(
        "Paystack checkout did not return a payment URL. Check PAYSTACK_SECRET_KEY on the API."
      );
    } catch (err) {
      setError(err.message || "Unable to start upgrade");
      setUpgrading(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-card" role="status">
        <Loader2 className="settings-spin" size={18} /> Loading plans…
      </div>
    );
  }

  const premiumPrice = plans?.premiumPrice ?? 49;
  const isAlreadyPremium =
    String(plans?.currentPlan || "").toLowerCase() === "premium";

  return (
    <div className="settings-stack">
      {banner ? (
        <p className="settings-banner" role="status">
          <CheckCircle2 size={16} />
          {banner}
        </p>
      ) : null}
      {error ? (
        <p className="settings-alert" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="settings-back-link"
        onClick={() => navigate("/workspace/settings/billing")}
      >
        ← Back to billing
      </button>

      <div className="settings-upgrade-head">
        <h2>Upgrade Plan</h2>
        <p>Move from Free to Premium whenever your team outgrows the basics.</p>
      </div>

      <div className="settings-plan-grid">
        <article className="settings-plan-card">
          <h3 className="settings-plan-card__name">Free</h3>
          <p className="settings-plan-card__tagline">For small teams getting started</p>
          <p className="settings-plan-card__price">
            $0 <span>/ month</span>
          </p>
          <ul className="settings-plan-card__features">
            {FREE_FEATURES.map((f) => (
              <li key={f}>
                <Check size={16} />
                {f}
              </li>
            ))}
          </ul>
          <button type="button" className="settings-btn settings-btn--secondary" disabled>
            Current plan
          </button>
        </article>

        <article className="settings-plan-card is-featured">
          <span className="settings-plan-badge" style={{ width: "fit-content" }}>
            Popular
          </span>
          <h3 className="settings-plan-card__name">Premium</h3>
          <p className="settings-plan-card__tagline">For growing support teams</p>
          <p className="settings-plan-card__price">
            ${premiumPrice} <span>/ month</span>
          </p>
          <ul className="settings-plan-card__features">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f}>
                <Check size={16} />
                {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="settings-btn settings-btn--primary"
            disabled={!canWrite || upgrading || isAlreadyPremium}
            onClick={handleUpgrade}
          >
            {upgrading ? <Loader2 size={16} className="settings-spin" /> : null}
            {isAlreadyPremium
              ? "Current plan"
              : upgrading
                ? "Starting checkout…"
                : "Upgrade plan"}
          </button>
        </article>
      </div>
    </div>
  );
}
