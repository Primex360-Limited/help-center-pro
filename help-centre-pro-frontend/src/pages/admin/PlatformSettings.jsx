import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BadgeCheck,
  Coins,
  Film,
  Megaphone,
  Server,
  TriangleAlert,
} from "lucide-react";
import { getPlans } from "../../api/admin.api.js";
import { getAnnouncement, getHowtoContent } from "../../api/platform.api.js";
import { ErrorBanner, LoadingBlock, PageHeader } from "../../components/admin/ui.jsx";
import { API_URL } from "../../config/env.js";
import { formatNaira } from "../../utils/currency.js";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

const SERVICE_LABELS = {
  postgresql: "PostgreSQL",
  mongodb: "MongoDB",
  redis: "Redis",
  email: "Email",
};

function serviceTone(status) {
  if (status === "up" || status === "configured") return "green";
  if (status === "degraded") return "amber";
  if (status === "down") return "red";
  return "muted";
}

export default function PlatformSettings() {
  const [plans, setPlans] = useState([]);
  const [trialPlan, setTrialPlan] = useState(null);
  const [howto, setHowto] = useState(null);
  const [announcement, setAnnouncement] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [planResult, howtoResult, announcementResult] = await Promise.all([
        getPlans(),
        getHowtoContent(),
        getAnnouncement(),
      ]);
      setPlans(planResult?.data?.plans || []);
      setTrialPlan(planResult?.data?.trialPlan || null);
      setHowto(howtoResult?.data?.howto || null);
      setAnnouncement(announcementResult?.data?.announcement || null);
    } catch (err) {
      setError(err.message || "Unable to load platform configuration");
    } finally {
      setLoading(false);
    }

    try {
      const response = await fetch(`${API_URL}/health`, { credentials: "include" });
      const payload = await response.json();
      setHealth(payload?.data || null);
    } catch {
      // Health is informational only — never block the screen.
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uptime = Number(health?.uptimeSeconds || 0);
  const uptimeLabel = uptime
    ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
    : "—";

  return (
    <div className="adm-page">
      <PageHeader
        title="Platform setting"
        subtitle="Live configuration this control centre is running with — nothing here is cached or simulated."
      />

      <ErrorBanner message={error} onRetry={load} />

      {loading ? (
        <div className="adm-card">
          <LoadingBlock label="Reading platform configuration…" />
        </div>
      ) : (
        <div className="set-grid">
          <section className="adm-card set-card">
            <div className="set-card__head">
              <Server size={16} />
              <h2>Runtime</h2>
            </div>
            <dl className="set-list">
              <div>
                <dt>API</dt>
                <dd>{health?.service || "help-centre-pro-api"}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{health?.version || "—"}</dd>
              </div>
              <div>
                <dt>Environment</dt>
                <dd>{health?.environment || "—"}</dd>
              </div>
              <div>
                <dt>Uptime</dt>
                <dd>{uptimeLabel}</dd>
              </div>
            </dl>
            <div className="set-services">
              {health?.services ? (
                Object.entries(health.services).map(([key, service]) => (
                  <span
                    key={key}
                    className={`adm-pill adm-pill--${serviceTone(service?.status)}`}
                    title={service?.message || service?.status}
                  >
                    <span className="adm-pill__dot" aria-hidden="true" />
                    {SERVICE_LABELS[key] || key}
                  </span>
                ))
              ) : (
                <span className="adm-pill adm-pill--muted">
                  <span className="adm-pill__dot" aria-hidden="true" />
                  Health unavailable
                </span>
              )}
            </div>
          </section>

          <section className="adm-card set-card">
            <div className="set-card__head">
              <Coins size={16} />
              <h2>Billing &amp; currency</h2>
            </div>
            <dl className="set-list">
              <div>
                <dt>Currency</dt>
                <dd>NGN (₦) — fixed</dd>
              </div>
              <div>
                <dt>Invoice issue day</dt>
                <dd>12th of each month</dd>
              </div>
              <div>
                <dt>Trial plan</dt>
                <dd>
                  {trialPlan?.label || "Trial"}
                  {trialPlan ? ` · ${trialPlan.seatLimit} seats` : ""}
                </dd>
              </div>
            </dl>
            <ul className="set-plan-list">
              {plans.map((plan) => (
                <li key={plan.key}>
                  <span>{plan.label}</span>
                  <strong>{formatNaira(plan.priceNgn)}</strong>
                </li>
              ))}
            </ul>
            <Link className="adm-link" to="/admin/plans">
              Edit plan pricing <ArrowUpRight size={14} />
            </Link>
          </section>
          <section className="adm-card set-card">
            <div className="set-card__head">
              <Megaphone size={16} />
              <h2>Workspace content</h2>
            </div>
            <dl className="set-list">
              <div>
                <dt>Announcement</dt>
                <dd>
                  {announcement?.status === "published" ? (
                    <span className="adm-pill adm-pill--green adm-pill--soft">
                      <span className="adm-pill__dot" aria-hidden="true" />
                      Published
                    </span>
                  ) : (
                    <span className="adm-pill adm-pill--muted adm-pill--soft">
                      <span className="adm-pill__dot" aria-hidden="true" />
                      Draft
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>How it works card</dt>
                <dd>{howto?.title || "—"}</dd>
              </div>
              <div>
                <dt>Video</dt>
                <dd>{howto?.videoUrl ? "Linked" : "Opens What’s new"}</dd>
              </div>
            </dl>
            <div className="set-links">
              <Link className="adm-link" to="/admin/announcements">
                <Megaphone size={13} /> Announcement
              </Link>
              <Link className="adm-link" to="/admin/howto">
                <Film size={13} /> How it works video
              </Link>
            </div>
          </section>

          <section className="adm-card set-card">
            <div className="set-card__head">
              <BadgeCheck size={16} />
              <h2>Data integrity</h2>
            </div>
            <ul className="set-checks">
              <li>No demo workspaces, tickets or test accounts are seeded</li>
              <li>Every invoice is derived from a live workspace subscription</li>
              <li>Each operator action is written to the audit log with its actor</li>
              <li>All amounts are integer Naira</li>
            </ul>
            <p className="set-note">
              <TriangleAlert size={13} />
              Platform keys and sender domains live in the API environment — never in the
              browser.
            </p>
          </section>

        </div>
      )}
    </div>
  );
}
