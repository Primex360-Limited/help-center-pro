import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { getPlans, updatePlan } from "../../api/admin.api.js";
import {
  Bar,
  EmptyBlock,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  SectionCard,
  SuccessBanner,
} from "../../components/admin/ui.jsx";
import { formatNaira, formatNumber } from "../../utils/currency.js";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

const EMPTY_EDIT = {
  key: "",
  label: "",
  tagline: "",
  priceNgn: 0,
  seatLimit: 1,
  extraSeatNgn: 0,
  ticketLimit: 0,
  featuresText: "",
  popular: false,
};

export default function Plans() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getPlans();
      setData(result?.data || null);
    } catch (err) {
      setError(err.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const plans = data?.plans || [];
  const distribution = data?.distribution || [];
  // The free trial tier is not sold on this screen — keep it out of the bars.
  const visibleDistribution = distribution.filter((row) => row.key !== "trial");

  function openEdit(plan) {
    setNotice("");
    setEdit({
      key: plan.key,
      label: plan.label,
      tagline: plan.tagline || "",
      priceNgn: plan.priceNgn,
      seatLimit: plan.seatLimit,
      extraSeatNgn: plan.extraSeatNgn,
      ticketLimit: plan.ticketLimit,
      featuresText: (plan.features || []).join("\n"),
      popular: Boolean(plan.popular),
    });
  }

  function setField(key) {
    return (event) =>
      setEdit((prev) => ({
        ...prev,
        [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value,
      }));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!edit) return;
    setSaving(true);
    setError("");
    try {
      const features = edit.featuresText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const result = await updatePlan(edit.key, {
        label: edit.label.trim(),
        tagline: edit.tagline.trim(),
        priceNgn: Number(edit.priceNgn) || 0,
        seatLimit: Number(edit.seatLimit) || 1,
        extraSeatNgn: Number(edit.extraSeatNgn) || 0,
        ticketLimit: Number(edit.ticketLimit) || 0,
        features,
        popular: Boolean(edit.popular),
      });

      setData(result?.data || data);
      setNotice(
        `${edit.label} updated. Workspaces on this plan now bill ${formatNaira(
          result?.data?.plan?.priceNgn ?? edit.priceNgn
        )}/month.`
      );
      setEdit(null);
    } catch (err) {
      setError(err.message || "Unable to save plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-page">
      <PageHeader title="Plans & Pricing" />

      <ErrorBanner message={error} onRetry={load} />
      <SuccessBanner message={notice} />

      {loading && !data ? (
        <div className="adm-card">
          <LoadingBlock label="Loading plan catalog…" />
        </div>
      ) : plans.length ? (
        <div className="adm-plan-grid">
          {plans.map((plan) => (
            <article
              key={plan.key}
              className={`adm-plan${plan.popular ? " adm-plan--popular" : ""}`}
            >
              {plan.popular ? <span className="adm-plan__badge">Most popular</span> : null}

              <div className="adm-plan__head">
                <h2 className="adm-plan__name">{plan.label}</h2>
                <button
                  type="button"
                  className="adm-plan__edit"
                  onClick={() => openEdit(plan)}
                  aria-label={`Edit ${plan.label} plan`}
                  title={`Edit ${plan.label}`}
                >
                  <Pencil size={13} />
                </button>
              </div>

              <p className="adm-plan__price">
                {formatNaira(plan.priceNgn)}
                <span>/mo</span>
              </p>

              <p className="adm-plan__meta">
                {plan.seatLimit} seats · {formatNaira(plan.extraSeatNgn)}/extra seat
                <br />
                Up to {formatNumber(plan.ticketLimit)} tickets/mo
              </p>

              <ul className="adm-plan__features">
                {(plan.features || []).map((feature) => (
                  <li key={feature}>
                    <Check size={12} strokeWidth={3} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <p className="adm-plan__foot">
                {(distribution.find((row) => row.key === plan.key)?.count || 0) === 1
                  ? "1 Tenant on this plan"
                  : `${distribution.find((row) => row.key === plan.key)?.count || 0} Tenants on this plan`}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="adm-card">
          <EmptyBlock
            title="No plans available"
            hint="Reload the page or check the API connection."
          />
        </div>
      )}

      <SectionCard title="Tenant distribution">
        {loading && !data ? (
          <LoadingBlock label="Loading distribution…" />
        ) : visibleDistribution.length ? (
          <div className="adm-dist">
            {visibleDistribution.map((row) => (
              <div key={row.key} className="adm-dist__row">
                <div className="adm-dist__head">
                  <span>{row.label}</span>
                  <span className="adm-dist__count">
                    {row.count} Tenant{row.count === 1 ? "" : "s"} · {row.share}%
                  </span>
                </div>
                <Bar value={row.share} tone="blue" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock title="No plan distribution yet" hint="Provision a workspace to see it." />
        )}
      </SectionCard>

      {edit ? (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <button
              type="button"
              className="admin-modal__close"
              onClick={() => setEdit(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2>Edit {edit.label} plan</h2>
            <p className="admin-modal__sub">
              Prices are charged in Naira through Paystack and apply to every workspace on this
              plan immediately.
            </p>

            <form className="admin-form" onSubmit={handleSave}>
              <div className="admin-form__row">
                <div>
                  <label htmlFor="plan-label">Plan name</label>
                  <input id="plan-label" value={edit.label} onChange={setField("label")} required />
                </div>
                <div>
                  <label htmlFor="plan-price">Monthly price (₦)</label>
                  <input
                    id="plan-price"
                    type="number"
                    min="0"
                    step="500"
                    value={edit.priceNgn}
                    onChange={setField("priceNgn")}
                    required
                  />
                </div>
              </div>

              <div className="admin-form__row">
                <div>
                  <label htmlFor="plan-seats">Included seats</label>
                  <input
                    id="plan-seats"
                    type="number"
                    min="1"
                    value={edit.seatLimit}
                    onChange={setField("seatLimit")}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="plan-extra">Extra seat price (₦)</label>
                  <input
                    id="plan-extra"
                    type="number"
                    min="0"
                    step="500"
                    value={edit.extraSeatNgn}
                    onChange={setField("extraSeatNgn")}
                  />
                </div>
              </div>

              <div className="admin-form__row">
                <div>
                  <label htmlFor="plan-tickets">Ticket limit / month</label>
                  <input
                    id="plan-tickets"
                    type="number"
                    min="0"
                    step="100"
                    value={edit.ticketLimit}
                    onChange={setField("ticketLimit")}
                  />
                </div>
                <div>
                  <label htmlFor="plan-tagline">Tagline</label>
                  <input id="plan-tagline" value={edit.tagline} onChange={setField("tagline")} />
                </div>
              </div>

              <div>
                <label htmlFor="plan-features">Features (one per line)</label>
                <textarea
                  id="plan-features"
                  rows={6}
                  value={edit.featuresText}
                  onChange={setField("featuresText")}
                />
              </div>

              <label className="adm-checkbox" htmlFor="plan-popular">
                <input
                  id="plan-popular"
                  type="checkbox"
                  checked={edit.popular}
                  onChange={setField("popular")}
                />
                Highlight as “Most popular”
              </label>

              <div className="admin-form__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setEdit(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                  {saving ? "Saving…" : "Save plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}
