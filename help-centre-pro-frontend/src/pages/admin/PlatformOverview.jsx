import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { getPlatformOverview } from "../../api/admin.api.js";
import {
  CardLink,
  EmptyBlock,
  ErrorBanner,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusPill,
} from "../../components/admin/ui.jsx";
import {
  formatDateTime,
  formatNaira,
  formatNumber,
  initialOf,
  tileColor,
} from "../../utils/currency.js";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

const ACTION_LABELS = {
  TENANT_PROVISIONED: "Workspace provisioned",
  TENANT_UPDATED: "Workspace updated",
  TENANT_SUSPENDED: "Workspace suspended",
  TENANT_REACTIVATED: "Workspace reactivated",
  TENANT_ADMIN_INVITED: "Workspace admin invited",
  TENANT_SESSIONS_REVOKED: "Workspace sessions revoked",
  USER_INVITED: "Team member invited",
  USER_STATUS_UPDATED: "Team status updated",
  LOGIN_SUCCESS: "Admin signed in",
  PASSWORD_CHANGED: "Password changed",
  PLAN_UPDATED: "Plan pricing updated",
  INVOICE_STATUS_UPDATED: "Invoice updated",
  WORKSPACE_PROFILE_UPDATED: "Workspace profile updated",
};

function actionLabel(action = "") {
  return (
    ACTION_LABELS[action] ||
    String(action)
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^./, (char) => char.toUpperCase())
  );
}

const LEVEL_TONE = { info: "violet", success: "green", warning: "amber", critical: "red" };

export default function PlatformOverview() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getPlatformOverview();
      setOverview(result?.data?.overview || null);
      setFetchedAt(new Date());
    } catch (err) {
      setError(err.message || "Failed to load platform overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = overview?.metrics || {};
  const trend = overview?.mrrTrend || { weeks: [] };
  const weeks = Array.isArray(trend.weeks) ? trend.weeks : [];
  const maxMrr = Math.max(1, ...weeks.map((week) => Number(week.mrr) || 0));
  const hasRevenue = weeks.some((week) => Number(week.mrr) > 0);

  const newest = overview?.newestWorkspaces || [];
  const activity = overview?.recentActivity || [];
  const announcement = overview?.liveAnnouncement || null;

  const change = Number(trend.changePercent || 0);
  const changeUp = change >= 0;
  const changeLabel = useMemo(() => {
    if (!hasRevenue) return "No recurring revenue yet";
    return `${changeUp ? "+" : ""}${change.toFixed(1)}% vs 12 weeks ago`;
  }, [change, changeUp, hasRevenue]);

  const pastDueCount = Number(metrics.pastDueInvoices || 0);
  const pastDueAmount = Number(metrics.pastDueAmount || 0);

  return (
    <div className="adm-page ov-page">
      <PageHeader title="Platform Overview">
        <span className="ov-updated">
          {fetchedAt ? `Updated ${formatDateTime(fetchedAt)}` : ""}
        </span>
        <button
          type="button"
          className="adm-btn adm-btn--outline adm-btn--sm"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? "adm-spin" : undefined} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </PageHeader>

      <ErrorBanner message={error} onRetry={load} />

      <div className="adm-kpi-grid">
        <KpiCard
          label="Active Tenants"
          value={formatNumber(metrics.activeTenants || 0)}
          meta={`${formatNumber(metrics.trialTenants || 0)} on trial · ${formatNumber(
            metrics.totalTenants || 0
          )} total`}
          metaTone="pos"
        />
        <KpiCard
          label="MRR"
          value={formatNaira(metrics.mrr)}
          meta={`ARR ${formatNaira(metrics.arr)}`}
          metaTone="pos"
        />
        <KpiCard
          label="Seats in use"
          value={formatNumber(metrics.seatsInUse || 0)}
          meta={`${formatNumber(metrics.ticketsLast30d || 0)} tickets / 30d`}
          metaTone="muted"
        />
        <KpiCard
          label="Past-Due Invoices"
          value={formatNumber(pastDueCount)}
          meta={`${formatNaira(pastDueAmount)} outstanding`}
          metaTone={pastDueCount > 0 ? "warn" : "muted"}
          valueTone={pastDueCount > 0 ? "amber" : "default"}
        />
      </div>
      <div className="ov-row ov-row--main">
        <SectionCard
          className="ov-mrr"
          title={
            <span className="ov-card-title">
              MRR last 12 weeks
              <span className="ov-card-title__sub">
                Recurring revenue across all paid plans
              </span>
            </span>
          }
          action={
            <div className="adm-chart-total">
              <strong>{formatNaira(metrics.mrr)}</strong>
              <span className={hasRevenue && changeUp ? "is-up" : "is-flat"}>
                {changeLabel}
              </span>
            </div>
          }
        >
          {loading && !overview ? (
            <LoadingBlock label="Loading revenue…" />
          ) : (
            <>
              <div
                className="adm-chart"
                role="img"
                aria-label="Monthly recurring revenue for the last 12 weeks"
              >
                {weeks.map((week) => {
                  const value = Number(week.mrr) || 0;
                  const height = Math.max(4, Math.round((value / maxMrr) * 100));
                  return (
                    <span
                      key={week.weekStart || week.label}
                      className="adm-chart__bar"
                      style={{ height: `${height}%` }}
                      title={`Week of ${new Date(week.weekStart).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                      })} — ${formatNaira(value)}`}
                    />
                  );
                })}
              </div>
              {!hasRevenue ? (
                <p className="ov-chart-note">
                  No paid subscriptions yet — revenue appears here as soon as a workspace
                  moves off trial.
                </p>
              ) : null}
            </>
          )}
        </SectionCard>

        <SectionCard
          className="ov-activity"
          title="Recent activity"
          action={<CardLink to="/admin/audit">Audit log</CardLink>}
        >
          {loading && !overview ? (
            <LoadingBlock label="Loading activity…" />
          ) : activity.length ? (
            <ul className="adm-activity">
              {activity.map((item) => (
                <li key={item.id} className="adm-activity__item">
                  <span className="adm-activity__dot" aria-hidden="true" />
                  <div className="adm-activity__body">
                    <p className="adm-activity__title">
                      {[item.actorName || item.actorEmail || "System", actionLabel(item.action)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="adm-activity__meta">
                      {[item.tenantName || item.entity, formatDateTime(item.createdAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock
              title="No platform activity yet"
              hint="Provision a workspace to start the audit trail."
            />
          )}

          <div className="ov-card-foot">
            <Link className="adm-link" to="/admin/audit">
              View full audit log <span aria-hidden="true">→</span>
            </Link>
          </div>
        </SectionCard>
      </div>

      <div className="ov-row ov-row--bottom">
        <SectionCard
          className="ov-workspaces"
          title="Newest workspaces"
          action={<CardLink to="/admin/tenants">All Tenants</CardLink>}
        >
          {loading && !overview ? (
            <LoadingBlock label="Loading workspaces…" />
          ) : newest.length ? (
            <div className="ov-ws-list">
              {newest.map((tenant) => (
                <Link key={tenant.id} className="ov-ws" to={`/admin/tenants/${tenant.id}`}>
                  <span
                    className="ov-ws__mark"
                    style={{ background: tileColor(tenant.name) }}
                    aria-hidden="true"
                  >
                    {initialOf(tenant.name)}
                  </span>
                  <span className="ov-ws__body">
                    <span className="ov-ws__name">{tenant.name}</span>
                    <span className="ov-ws__meta">
                      {[
                        tenant.country,
                        tenant.industry || tenant.primaryDomain || tenant.slug,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <StatusPill
                    status={tenant.trial ? "trial" : tenant.status}
                    variant="soft"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyBlock
              title="No workspaces yet"
              hint="Invite the first tenant to get started."
            />
          )}
        </SectionCard>

        <SectionCard
          className="ov-announce"
          title="Live Announcement"
          action={<CardLink to="/admin/announcements">Manage</CardLink>}
        >
          {announcement ? (
            <div className="ov-announce__body">
              <div className="ov-announce__head">
                <span className={`adm-pill adm-pill--${LEVEL_TONE[announcement.level] || "violet"}`}>
                  <span className="adm-pill__dot" aria-hidden="true" />
                  {announcement.level}
                </span>
                {announcement.publishedAt ? (
                  <span className="ov-announce__time">
                    {formatDateTime(announcement.publishedAt)}
                  </span>
                ) : null}
              </div>
              <p className="ov-announce__title">{announcement.title}</p>
              {announcement.body ? (
                <p className="ov-announce__text">{announcement.body}</p>
              ) : null}
              {announcement.linkUrl ? (
                <a
                  className="adm-link"
                  href={announcement.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {announcement.linkLabel || "Learn more"} →
                </a>
              ) : null}
            </div>
          ) : (
            <EmptyBlock
              title="No live announcement"
              hint="Publish a banner to every workspace from the Announcement module."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
