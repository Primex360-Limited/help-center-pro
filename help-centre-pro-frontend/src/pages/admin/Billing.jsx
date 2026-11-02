import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Download, ReceiptText, Search, X } from "lucide-react";
import {
  exportBillingCsv,
  getBilling,
  updateInvoiceStatus,
} from "../../api/admin.api.js";
import {
  EmptyBlock,
  ErrorBanner,
  KpiCard,
  LoadingBlock,
  PageHeader,
  StatusPill,
  SuccessBanner,
} from "../../components/admin/ui.jsx";
import { formatDate, formatDateLong, formatDateTime, formatNaira } from "../../utils/currency.js";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "paid", label: "Paid" },
  { value: "open", label: "Open" },
  { value: "past_due", label: "Past due" },
  { value: "refunded", label: "Refunded" },
  { value: "void", label: "Void" },
];

const STATUS_VALUES = STATUS_OPTIONS.map((option) => option.value);

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get("status") || "all";

  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState(STATUS_VALUES.includes(urlStatus) ? urlStatus : "all");

  const [selected, setSelected] = useState(null);
  // `{ id, status }` for the invoice whose status is being written right now.
  const [updating, setUpdating] = useState(null);

  // Deep links such as the sidebar bell ("/admin/billing?status=past_due").
  useEffect(() => {
    setStatus(STATUS_VALUES.includes(urlStatus) ? urlStatus : "all");
  }, [urlStatus]);

  const load = useCallback(async (params) => {
    setLoading(true);
    setError("");
    try {
      const result = await getBilling(params);
      setBilling(result?.data || null);
    } catch (err) {
      setError(err.message || "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load({ q, status });
    }, 220);
    return () => clearTimeout(timer);
  }, [q, status, load]);

  // Esc closes the invoice drawer.
  useEffect(() => {
    if (!selected) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const summary = useMemo(() => billing?.summary || {}, [billing]);
  const invoices = billing?.invoices || [];
  const filteredCount = billing?.filteredCount ?? invoices.length;
  const totalCount = billing?.totalCount ?? invoices.length;

  function changeFilterStatus(next) {
    setStatus(next);
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("status");
    else params.set("status", next);
    setSearchParams(params, { replace: true });
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    setNotice("");
    try {
      await exportBillingCsv({ q, status });
      setNotice(
        `Exported ${filteredCount} invoice${filteredCount === 1 ? "" : "s"} as CSV.`
      );
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function changeInvoiceStatus(invoice, nextStatus) {
    setUpdating({ id: invoice.id, status: nextStatus });
    setError("");
    try {
      const result = await updateInvoiceStatus(invoice.id, nextStatus);
      const updated = result?.data?.invoice || result?.data;
      if (updated?.id) setSelected(updated);
      setNotice(`${invoice.number} marked ${nextStatus.replace("_", " ")}.`);
      await load({ q, status });
    } catch (err) {
      setError(err.message || "Unable to update invoice");
    } finally {
      setUpdating(null);
    }
  }

  /**
   * Row shortcut. "Mark paid" is safe and writes immediately; "Refund" and
   * "View" open the invoice drawer so the operator confirms against the full
   * invoice (amount, period, workspace) before money moves.
   */
  function handleRowAction(event, invoice, action) {
    event.stopPropagation();
    if (action === "paid") {
      changeInvoiceStatus(invoice, "paid");
      return;
    }
    setSelected(invoice);
  }

  /** The single call-to-action shown on the right of every invoice row. */
  function rowAction(invoice) {
    const busy = updating?.id === invoice.id;
    if (invoice.status === "paid") {
      return (
        <button
          type="button"
          className="bil-act bil-act--refund"
          title={`Review ${invoice.number} before refunding`}
          onClick={(event) => handleRowAction(event, invoice, "refund")}
        >
          Refund
        </button>
      );
    }
    if (invoice.status === "past_due" || invoice.status === "open") {
      return (
        <button
          type="button"
          className="bil-act bil-act--pay"
          disabled={busy}
          title={`Settle ${invoice.number} as paid`}
          onClick={(event) => handleRowAction(event, invoice, "paid")}
        >
          {busy ? "Saving…" : "Mark paid"}
        </button>
      );
    }
    return (
      <button
        type="button"
        className="bil-act bil-act--view"
        title={`Open ${invoice.number}`}
        onClick={(event) => handleRowAction(event, invoice, "view")}
      >
        View
      </button>
    );
  }

  const kpis = useMemo(
    () => [
      {
        label: "Total Collected",
        value: formatNaira(summary.totalCollected),
        meta: `${summary.paidCount || 0} paid invoice${summary.paidCount === 1 ? "" : "s"}`,
        metaTone: "pos",
      },
      {
        label: "Outstanding",
        value: formatNaira(summary.outstandingAmount),
        meta: `${summary.outstandingCount || 0} invoice${
          summary.outstandingCount === 1 ? "" : "s"
        } open`,
        metaTone: summary.outstandingCount ? "warn" : "muted",
      },
      {
        label: "Past Due",
        value: formatNaira(summary.pastDueAmount),
        meta: summary.pastDueCount ? "Requires attention" : "Nothing overdue",
        metaTone: summary.pastDueCount ? "danger" : "muted",
      },
      {
        label: "Refunded",
        value: formatNaira(summary.refundedAmount),
        meta: "Lifetime",
        metaTone: "muted",
      },
    ],
    [summary]
  );

  return (
    <div className="adm-page bil-page">
      <PageHeader title="Billing" subtitle="Subscription invoices across every workspace">
        <button
          type="button"
          className="adm-btn adm-btn--light"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download size={15} />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </PageHeader>

      <ErrorBanner message={error} onRetry={() => load({ q, status })} />
      <SuccessBanner message={notice} />

      <div className="adm-kpi-grid">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>
      <div className="adm-filterbar bil-filters">
        <label className="adm-search-inline" htmlFor="bil-search">
          <Search size={15} />
          <input
            id="bil-search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search invoice, ID or tenant…"
            autoComplete="off"
          />
          {q ? (
            <button
              type="button"
              className="adm-search-inline__clear"
              onClick={() => setQ("")}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          ) : null}
        </label>

        <select
          className="adm-select"
          value={status}
          onChange={(event) => changeFilterStatus(event.target.value)}
          aria-label="Filter invoices by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <span className="adm-visually-hidden" role="status" aria-live="polite">
          Showing {filteredCount} of {totalCount} invoices
        </span>
      </div>

      <div className="adm-card bil-table-card">
        <div className="adm-table-wrap">
          <table className="adm-table bil-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Tenant</th>
                <th>Plan</th>
                <th>Issued</th>
                <th>Amount</th>
                <th>Status</th>
                <th className="adm-action-cell">
                  <span className="adm-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && !billing ? (
                <tr className="is-static">
                  <td colSpan={7}>
                    <LoadingBlock label="Loading invoices…" />
                  </td>
                </tr>
              ) : invoices.length ? (
                invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="bil-row"
                    tabIndex={0}
                    onClick={() => setSelected(invoice)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(invoice);
                      }
                    }}
                  >
                    <td className="adm-mono adm-strong">{invoice.number}</td>
                    <td>
                      <span className="bil-tenant" title={invoice.tenantSlug || undefined}>
                        {invoice.tenantName}
                      </span>
                    </td>
                    <td>{invoice.planLabel}</td>
                    <td className="adm-muted">{formatDateLong(invoice.issuedAt)}</td>
                    <td className="adm-strong">{formatNaira(invoice.amount)}</td>
                    <td>
                      <StatusPill status={invoice.status} variant="soft" />
                    </td>
                    <td className="adm-action-cell">{rowAction(invoice)}</td>
                  </tr>
                ))
              ) : (
                <tr className="is-static">
                  <td colSpan={7}>
                    <EmptyBlock
                      title="No invoices match this filter"
                      hint="Invoices appear automatically once a workspace leaves trial on a paid plan."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selected ? (
        <div
          className="admin-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bil-modal-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <div className="admin-modal bil-modal">
            <button
              type="button"
              className="admin-modal__close"
              onClick={() => setSelected(null)}
              aria-label="Close invoice"
              autoFocus
            >
              <X size={18} />
            </button>

            <h2 id="bil-modal-title">{selected.number}</h2>
            <p className="admin-modal__sub">
              {selected.tenantName} · {selected.planLabel} · {formatNaira(selected.amount)}
            </p>

            <div className="admin-detail-grid">
              <div className="admin-detail-item">
                <span>Status</span>
                <strong>
                  <StatusPill status={selected.status} variant="soft" />
                </strong>
              </div>
              <div className="admin-detail-item">
                <span>Issued</span>
                <strong>{formatDateTime(selected.issuedAt)}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Billing period</span>
                <strong>{selected.periodLabel || selected.periodMonth}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Currency</span>
                <strong>NGN (₦)</strong>
              </div>
              <div className="admin-detail-item">
                <span>Paid at</span>
                <strong>{selected.paidAt ? formatDateTime(selected.paidAt) : "—"}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Refunded at</span>
                <strong>{selected.refundedAt ? formatDateTime(selected.refundedAt) : "—"}</strong>
              </div>
            </div>

            <div className="bil-modal__meta">
              <ReceiptText size={14} />
              <span>
                Issued {formatDate(selected.issuedAt)} ·{" "}
                {selected.status === "paid"
                  ? "settled in full"
                  : selected.status === "refunded"
                    ? "refunded to the workspace"
                    : selected.status === "void"
                      ? "voided — no money moves"
                      : "awaiting payment"}
              </span>
            </div>

            <div className="bil-modal__foot">
              <Link className="adm-btn adm-btn--outline" to={`/admin/tenants/${selected.tenantId}`}>
                Open workspace
                <ArrowUpRight size={14} />
              </Link>

              <div className="bil-modal__actions">
                <button
                  type="button"
                  className="adm-btn adm-btn--danger"
                  disabled={Boolean(updating) || ["refunded", "void"].includes(selected.status)}
                  onClick={() => changeInvoiceStatus(selected, "refunded")}
                >
                  {updating?.status === "refunded" ? "Refunding…" : "Refund"}
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn--outline"
                  disabled={Boolean(updating) || ["past_due", "void"].includes(selected.status)}
                  onClick={() => changeInvoiceStatus(selected, "past_due")}
                >
                  {updating?.status === "past_due" ? "Saving…" : "Mark past due"}
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn--primary"
                  disabled={Boolean(updating) || selected.status === "paid"}
                  onClick={() => changeInvoiceStatus(selected, "paid")}
                >
                  {updating?.status === "paid" ? "Saving…" : "Mark paid"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
