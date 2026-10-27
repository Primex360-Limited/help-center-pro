import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sun } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getBillingStatus, verifyBillingPayment } from "../../api/settings.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/settings-premium.css";

export default function BillingSettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("settings:write");

  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getBillingStatus();
      const data = res?.data?.billing || res?.data || res || null;
      setBilling(data);
    } catch (err) {
      setError(err.message || "Failed to load billing");
      setBilling({ plan: "free", premiumPriceMonthlyUsd: 49 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const reference =
      searchParams.get("reference") ||
      searchParams.get("trxref") ||
      searchParams.get("payment_reference");
    if (!reference || verifying) return undefined;

    let cancelled = false;
    (async () => {
      setVerifying(true);
      setError("");
      try {
        const res = await verifyBillingPayment({ reference });
        if (cancelled) return;
        setBanner(res?.message || "Payment verified. Your workspace is on Premium.");
        const next = res?.data?.billing || res?.data || { plan: "premium" };
        setBilling(next);
        setSearchParams({}, { replace: true });
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not verify payment");
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, verifying]);

  if (loading || verifying) {
    return (
      <div className="settings-card" role="status">
        <Loader2 className="settings-spin" size={18} />{" "}
        {verifying ? "Verifying payment…" : "Loading billing…"}
      </div>
    );
  }

  const isPremium = String(billing?.plan || "free").toLowerCase() === "premium";
  const priceUsd = Number(billing?.premiumPriceMonthlyUsd ?? 49);

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

      <section className="settings-card settings-billing-card">
        <div className="settings-billing-row">
          <div className="settings-billing-row__left">
            <span className="settings-billing-hero__icon" aria-hidden="true">
              <Sun size={20} />
            </span>
            <div>
              <p className="settings-billing-kicker">Current plan</p>
              <h2 className="settings-billing-plan-name">
                {isPremium ? "Premium" : "Free"}
              </h2>
            </div>
          </div>
          <div className="settings-billing-amount">
            <strong>{isPremium ? `$${priceUsd}` : "$0"}</strong>
            <span>per month</span>
          </div>
        </div>

        {!isPremium ? (
          <>
            <button
              type="button"
              className="settings-btn settings-btn--primary settings-btn--block"
              disabled={!canWrite}
              onClick={() => navigate("/workspace/settings/billing/upgrade")}
            >
              Upgrade plan ↗
            </button>
            <p className="settings-billing-foot">
              Move to Premium for unlimited agents, every channel, and API access.
            </p>
          </>
        ) : (
          <p className="settings-billing-foot">
            You are on Premium
            {billing?.upgradedAt
              ? ` · since ${new Date(billing.upgradedAt).toLocaleDateString()}`
              : ""}
            .
          </p>
        )}
      </section>
    </div>
  );
}
