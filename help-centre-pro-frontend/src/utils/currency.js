/**
 * Naira-only money helpers for the provider admin portal.
 * Every amount that comes back from `/admin/*` is an integer Naira value.
 */

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatNaira(value) {
  const amount = Number(value);
  return `₦${nairaFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
}

/** `₦298.5K` — compact form for tight KPI/meta slots. */
export function formatNairaCompact(value) {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 100_000) return `₦${(amount / 1000).toFixed(0)}K`;
  return formatNaira(amount);
}

export function formatNumber(value) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-NG").format(Number.isFinite(amount) ? amount : 0);
}

export function formatPercent(value, digits = 1) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0%";
  return `${amount.toFixed(digits).replace(/\.0$/, "")}%`;
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** `June 12, 2026` — long date, used by the Billing "Issued" column. */
export function formatDateLong(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** `June 19, 11:12am` — compact stamp used by the Tenants "Last Active" column. */
export function formatDateTimeShort(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.toLocaleDateString("en-NG", { month: "long", day: "numeric" });
  const time = date
    .toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
    .replace(/\s+/g, "")
    .toLowerCase();
  return `${day}, ${time}`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Deterministic workspace avatar tint, like the mock's coloured tiles. */
const TILE_COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#ef4444",
  "#8b5cf6",
  "#10b981",
  "#ec4899",
  "#eab308",
  "#14b8a6",
  "#f97316",
  "#6366f1",
];

export function tileColor(seed = "") {
  const text = String(seed);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 9973;
  }
  return TILE_COLORS[hash % TILE_COLORS.length];
}

export function initialOf(name = "") {
  return (String(name).trim()[0] || "W").toUpperCase();
}
