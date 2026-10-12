import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPlatformOverview } from "../../api/admin.api.js";
import "../../styles/admin.css";

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function formatAction(action = "") {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function PlatformOverview() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getPlatformOverview();
        if (!cancelled) setOverview(result?.data?.overview || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load overview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = overview?.metrics || {};
  const trend = overview?.mrrTrend || { weeks: [] };
  const maxMrr = Math.max(1, ...(trend.weeks || []).map((week) => week.mrr || 0));

  return (
    <div>
      <h1 className="admin-page-title">Platform Overview</h1>

      {error ? <p className="auth-error">{error}</p> : null}
      {loading ? <p className="admin-empty">Loading platform metrics...</p> : null}

      {!loading && overview ? (
        <>
          <div className="admin-kpi-grid">
            <article className="admin-card">
              <p className="admin-kpi__label">Active Tenants</p>
              <p className="admin-kpi__value">{metrics.activeTenants || 0}</p>
              <p className="admin-kpi__meta">
                {metrics.trialTenants || 0} on trial · {metrics.totalTenants || 0} total
              </p>
            </article>
            <article className="admin-card">
              <p className="admin-kpi__label">MRR</p>
              <p className="admin-kpi__value">{money(metrics.mrr)}</p>
              <p className="admin-kpi__meta">ARR {money(metrics.arr)}</p>
            </article>
            <article className="admin-card">
              <p className="admin-kpi__label">Seats in use</p>
              <p className="admin-kpi__value">{metrics.seatsInUse || 0}</p>
              <p className="admin-kpi__meta">
                {(metrics.ticketsLast30d || 0).toLocaleString()} tickets / 30d
              </p>
            </article>
            <article className="admin-card">
              <p className="admin-kpi__label">Past-Due Invoices</p>
              <p className="admin-kpi__value">{metrics.pastDueInvoices || 0}</p>
              <p className="admin-kpi__meta">
                {money(metrics.pastDueAmount)} outstanding
              </p>
            </article>
          </div>

          <div className="admin-mid-grid">
            <article className="admin-card">
              <div className="admin-card__header">
                <div>
                  <h2>MRR — last 12 weeks</h2>
                  <p>Recurring revenue across all paid plans.</p>
                </div>
                <div className="admin-mrr-stat">
                  <strong>{money(trend.currentMrr)}</strong>
                  <span>
                    {trend.changePercent >= 0 ? "+" : ""}
                    {Number(trend.changePercent || 0).toFixed(1)}% VS Prev quarter
                  </span>
                </div>
              </div>
              <div className="admin-chart" aria-hidden="true">
                {(trend.weeks || []).map((week, index) => (
                  <div
                    key={week.weekStart || index}
                    className="admin-chart__bar"
                    style={{
                      height: `${Math.max(12, ((week.mrr || 0) / maxMrr) * 100)}%`,
                      opacity: 0.55 + (index / 24),
                    }}
                    title={money(week.mrr)}
                  />
                ))}
              </div>
            </article>

            <article className="admin-card">
              <div className="admin-card__header">
                <div>
                  <h2>Recent activity</h2>
                </div>
              </div>
              {overview.recentActivity?.length ? (
                <div className="admin-activity-list">
                  {overview.recentActivity.map((item) => (
                    <div key={item.id} className="admin-activity-item">
                      <div>
                        <strong>{formatAction(item.action)}</strong>
                        <span>{item.entity}</span>
                      </div>
                      <span>
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString()
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="admin-empty">No recent platform activity yet.</p>
              )}
            </article>
          </div>

          <div className="admin-bottom-grid">
            <article className="admin-card">
              <div className="admin-card__header">
                <h2>Newest workspaces</h2>
                <Link className="admin-card__link" to="/admin/tenants">
                  All Tenants
                </Link>
              </div>
              {overview.newestWorkspaces?.length ? (
                <div className="admin-activity-list">
                  {overview.newestWorkspaces.map((tenant) => (
                    <div key={tenant.id} className="admin-activity-item">
                      <div>
                        <strong>{tenant.name}</strong>
                        <span>
                          {tenant.planLabel} · {tenant.status}
                        </span>
                      </div>
                      <span>{tenant.admin?.email || tenant.slug}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="admin-empty">No workspaces yet.</p>
              )}
            </article>

            <article className="admin-card">
              <div className="admin-card__header">
                <h2>Live Announcement</h2>
                <span className="admin-card__link">Manage</span>
              </div>
              <p className="admin-empty">
                {overview.liveAnnouncement || "No live announcement published."}
              </p>
            </article>
          </div>
        </>
      ) : null}
    </div>
  );
}
