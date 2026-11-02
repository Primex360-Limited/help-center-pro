import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPlatformAnalytics } from "../../api/admin.api.js";
import {
  Bar,
  EmptyBlock,
  ErrorBanner,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
} from "../../components/admin/ui.jsx";
import { formatNaira, formatNairaCompact, formatNumber } from "../../utils/currency.js";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

export default function PlatformAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getPlatformAnalytics();
      setAnalytics(result?.data || null);
    } catch (err) {
      setError(err.message || "Failed to load platform analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = analytics?.metrics || {};
  const revenue = analytics?.revenueSixMonths || [];
  const maxRevenue = Math.max(1, ...revenue.map((row) => Number(row.revenue) || 0));
  const planMix = analytics?.planMix || [];
  const byCountry = analytics?.byCountry || [];
  const byIndustry = analytics?.byIndustry || [];
  const topAccounts = analytics?.topAccounts || [];

  return (
    <div className="adm-page">
      <PageHeader title="Platform Analytics" />

      <ErrorBanner message={error} onRetry={load} />

      <div className="adm-kpi-grid">
        <KpiCard
          label="MRR"
          value={formatNaira(metrics.mrr)}
          meta="Across all active plans"
          valueTone="rose"
        />
        <KpiCard label="ARR" value={formatNaira(metrics.arr)} meta="Run-rate" valueTone="rose" />
        <KpiCard
          label="ARPU"
          value={formatNaira(metrics.arpu)}
          meta="Avg revenue/active tenant"
          valueTone="rose"
        />
        <KpiCard
          label="Churn rate"
          value={`${Number(metrics.churnRate || 0).toFixed(1)}%`}
          meta={
            metrics.churnedCount ? `${metrics.churnedCount} cancelled total` : "No cancellations"
          }
          valueTone="rose"
          metaTone="muted"
        />
      </div>

      <div className="adm-grid-analytics">
        <SectionCard title="Paid revenue — last 6 month">
          {loading && !analytics ? (
            <LoadingBlock label="Loading revenue…" />
          ) : (
            <>
              <div className="adm-rev__chart" aria-hidden="true">
                {revenue.map((row) => (
                  <div key={row.month} className="adm-rev__col">
                    <span className="adm-rev__value">{formatNairaCompact(row.revenue)}</span>
                    <span
                      className="adm-rev__bar"
                      style={{
                        height: `${Math.max(
                          row.revenue > 0 ? 10 : 3,
                          (row.revenue / maxRevenue) * 100
                        )}%`,
                      }}
                      title={formatNaira(row.revenue)}
                    />
                  </div>
                ))}
              </div>
              <div className="adm-rev__labels">
                {revenue.map((row) => (
                  <span key={row.month}>{row.label}</span>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Plan mix">
          {loading && !analytics ? (
            <LoadingBlock label="Loading plan mix…" />
          ) : planMix.length ? (
            <div className="adm-list">
              {planMix.map((row) => (
                <div key={row.key} className="adm-list__row">
                  <div className="adm-list__head">
                    <span>{row.label}</span>
                    <span className="adm-list__meta">{formatNumber(row.count)}</span>
                  </div>
                  <Bar value={row.share} tone="rose" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No plans in use yet" />
          )}
        </SectionCard>
      </div>

      <div className="adm-grid-2">
        <SectionCard title="Tenants by country">
          {loading && !analytics ? (
            <LoadingBlock label="Loading countries…" />
          ) : byCountry.length ? (
            <div className="adm-list">
              {byCountry.map((row) => (
                <div key={row.label} className="adm-list__row">
                  <div className="adm-list__head">
                    <span>{row.label}</span>
                    <span className="adm-list__meta">{formatNumber(row.count)}</span>
                  </div>
                  <Bar value={row.share} tone="rose" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No country data yet" hint="Add a country when inviting tenants." />
          )}
        </SectionCard>

        <SectionCard title="Tenants by industry">
          {loading && !analytics ? (
            <LoadingBlock label="Loading industries…" />
          ) : byIndustry.length ? (
            <div className="adm-list">
              {byIndustry.map((row) => (
                <div key={row.label} className="adm-list__row">
                  <div className="adm-list__head">
                    <span>{row.label}</span>
                    <span className="adm-list__meta">{formatNumber(row.count)}</span>
                  </div>
                  <Bar value={row.share} tone="amber" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No industry data yet" hint="Industries come from workspace setup." />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Top revenue accounts">
        <table className="adm-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Tenants</th>
              <th>Plan</th>
              <th className="adm-num">MRR</th>
              <th className="adm-num">Tickets / 30D</th>
            </tr>
          </thead>
          <tbody>
            {loading && !analytics ? (
              <tr className="is-static">
                <td colSpan={5}>
                  <LoadingBlock label="Loading accounts…" />
                </td>
              </tr>
            ) : topAccounts.length ? (
              topAccounts.map((account, index) => (
                <tr key={account.id} className="is-static">
                  <td className="adm-muted">{index + 1}</td>
                  <td>
                    <Link className="adm-table-link" to={`/admin/tenants/${account.id}`}>
                      {account.name}
                    </Link>
                  </td>
                  <td className="adm-muted">{account.planLabel}</td>
                  <td className="adm-num adm-strong">{formatNaira(account.mrr)}</td>
                  <td className="adm-num">{formatNumber(account.ticketsLast30d)}</td>
                </tr>
              ))
            ) : (
              <tr className="is-static">
                <td colSpan={5}>
                  <EmptyBlock title="No revenue accounts yet" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </SectionCard>

    </div>
  );
}
