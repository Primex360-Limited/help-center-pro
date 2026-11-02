import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatNumber } from "../../utils/currency.js";

/**
 * Shared building blocks for the provider Admin Portal screens.
 * Kept tiny + presentational so every screen looks identical.
 */

const STATUS_MAP = {
  active: { label: "Active", tone: "green" },
  trial: { label: "Trial", tone: "amber" },
  provisioning: { label: "Provisioning", tone: "violet" },
  suspended: { label: "Suspended", tone: "red" },
  canceled: { label: "Cancelled", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "muted" },
  inactive: { label: "Disabled", tone: "muted" },
  disabled: { label: "Disabled", tone: "muted" },
  invited: { label: "Invited", tone: "violet" },
  paid: { label: "Paid", tone: "green" },
  open: { label: "Open", tone: "amber" },
  past_due: { label: "Past due", tone: "amber" },
  refunded: { label: "Refunded", tone: "red" },
  void: { label: "Void", tone: "muted" },
};

export function StatusPill({ status, label, variant = "solid", upper = false }) {
  const normalized = String(status || "").toLowerCase();
  const entry = STATUS_MAP[normalized] || { label: status || "Unknown", tone: "muted" };
  return (
    <span
      className={`adm-pill adm-pill--${entry.tone}${
        variant === "soft" ? " adm-pill--soft" : ""
      }${upper ? " adm-pill--upper" : ""}`}
    >
      <span className="adm-pill__dot" aria-hidden="true" />
      {label || entry.label}
    </span>
  );
}

export function KpiCard({ label, value, meta, metaTone = "muted", valueTone = "default" }) {
  return (
    <article className="adm-card adm-kpi">
      <p className="adm-kpi__label">{label}</p>
      <p className={`adm-kpi__value adm-kpi__value--${valueTone}`}>{value}</p>
      {meta ? <p className={`adm-kpi__meta adm-kpi__meta--${metaTone}`}>{meta}</p> : null}
    </article>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="adm-page-head">
      <div>
        <h1 className="adm-page-title">{title}</h1>
        {subtitle ? <p className="adm-page-sub">{subtitle}</p> : null}
      </div>
      {children ? <div className="adm-page-actions">{children}</div> : null}
    </header>
  );
}

export function SectionCard({ title, action, children, className = "" }) {
  return (
    <article className={`adm-card${className ? ` ${className}` : ""}`}>
      {title || action ? (
        <div className="adm-card__head">
          <h2 className="adm-card__title">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </article>
  );
}

export function CardLink({ to, onClick, children }) {
  if (to) {
    return (
      <Link className="adm-link" to={to}>
        {children}
        <ArrowUpRight size={14} />
      </Link>
    );
  }
  return (
    <button type="button" className="adm-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={14} />
    </button>
  );
}

export function LoadingBlock({ label = "Loading…" }) {
  return (
    <div className="adm-loading">
      <Loader2 size={18} className="adm-spin" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyBlock({ title = "Nothing here yet", hint }) {
  return (
    <div className="adm-empty">
      <p className="adm-empty__title">{title}</p>
      {hint ? <p className="adm-empty__hint">{hint}</p> : null}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="adm-banner adm-banner--error" role="alert">
      <TriangleAlert size={16} />
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="adm-banner__action" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div className="adm-banner adm-banner--success" role="status">
      <CheckCircle2 size={16} />
      <span>{message}</span>
    </div>
  );
}

export function CountBadge({ value }) {
  return <span className="adm-count">{formatNumber(value)}</span>;
}

export function RowChevron() {
  return (
    <span className="adm-row-chevron" aria-hidden="true">
      <ChevronRight size={16} />
    </span>
  );
}

export function Bar({ value, tone = "rose" }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <span className={`adm-bar adm-bar--${tone}`}>
      <span className="adm-bar__fill" style={{ width: `${width}%` }} />
    </span>
  );
}
