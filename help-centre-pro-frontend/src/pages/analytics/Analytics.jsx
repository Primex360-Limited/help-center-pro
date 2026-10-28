import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  Ticket,
  CircleDot,
} from "lucide-react";
import { getTicketAnalytics } from "../../api/tickets.api.js";
import { formatNumber } from "../../utils/format.js";
import "../../styles/app.css";
import "../../styles/analytics.css";

const PERIODS = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];

const AGENT_TONES = ["tone-blue", "tone-green", "tone-violet", "tone-orange"];

const EMPTY = {
  kpis: {
    totalTickets: { value: 0, changePercent: 0 },
    openTickets: { value: 0, changePercent: 0 },
    resolved: { value: 0, changePercent: 0 },
    resolutionRate: { value: 0, changePercent: 0 },
  },
  volumeOverTime: [],
  statusBreakdown: [],
  channelBreakdown: [],
  priorityBreakdown: [],
  avgResolutionRate: 0,
  topAgents: [],
};

function changeClass(value) {
  if (value > 0) return "is-up";
  if (value < 0) return "is-down";
  return "is-flat";
}

function formatChange(value) {
  const n = Number(value) || 0;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}% vs last period`;
}

function VolumeLineChart({ series = [] }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const width = 920;
  const height = 260;
  const pad = { top: 24, right: 16, bottom: 36, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxY = Math.max(
    4,
    ...series.flatMap((d) => [d.created || 0, d.resolved || 0, d.pending || 0])
  );
  const niceMax = Math.ceil(maxY / 4) * 4 || 4;
  const ticks = [0, niceMax / 4, niceMax / 2, (niceMax * 3) / 4, niceMax];

  function xAt(i) {
    if (series.length <= 1) return pad.left + innerW / 2;
    return pad.left + (i / (series.length - 1)) * innerW;
  }

  function yAt(value) {
    return pad.top + innerH - (value / niceMax) * innerH;
  }

  function pathFor(key) {
    if (!series.length) return "";
    return series
      .map((point, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(point[key] || 0)}`)
      .join(" ");
  }

  const labelStep = Math.max(1, Math.ceil(series.length / 8));
  const hover = hoverIndex != null ? series[hoverIndex] : null;

  return (
    <div className="an-line">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="an-line__svg"
        role="img"
        aria-label="Ticket volume over time"
        onMouseLeave={() => setHoverIndex(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yAt(tick)}
              y2={yAt(tick)}
              className="an-line__grid"
            />
            <text x={pad.left - 8} y={yAt(tick) + 4} className="an-line__tick" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}

        <path d={pathFor("created")} className="an-line__path an-line__path--created" />
        <path d={pathFor("resolved")} className="an-line__path an-line__path--resolved" />
        <path d={pathFor("pending")} className="an-line__path an-line__path--pending" />

        {series.map((point, i) => (
          <rect
            key={point.date}
            x={xAt(i) - innerW / Math.max(series.length, 1) / 2}
            y={pad.top}
            width={Math.max(8, innerW / Math.max(series.length, 1))}
            height={innerH}
            className="an-line__hit"
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}

        {hoverIndex != null ? (
          <line
            x1={xAt(hoverIndex)}
            x2={xAt(hoverIndex)}
            y1={pad.top}
            y2={pad.top + innerH}
            className="an-line__cross"
          />
        ) : null}

        {series.map((point, i) =>
          i % labelStep === 0 || i === series.length - 1 ? (
            <text
              key={`lbl-${point.date}`}
              x={xAt(i)}
              y={height - 10}
              className="an-line__xlabel"
              textAnchor="middle"
            >
              {point.label}
            </text>
          ) : null
        )}
      </svg>

      {hover ? (
        <div
          className="an-line__tooltip"
          style={{
            left: `${((hoverIndex || 0) / Math.max(series.length - 1, 1)) * 100}%`,
          }}
        >
          <strong>{hover.label}</strong>
          <span>
            <i className="dot-created" /> Created {hover.created}
          </span>
          <span>
            <i className="dot-resolved" /> Resolved {hover.resolved}
          </span>
          <span>
            <i className="dot-pending" /> Pending {hover.pending}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function StatusDonut({ items = [] }) {
  const total = items.reduce((sum, item) => sum + (item.count || 0), 0) || 1;
  const radius = 70;
  const stroke = 22;
  const c = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="an-donut">
      <svg viewBox="0 0 180 180" className="an-donut__svg" aria-hidden="true">
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="#f2f4f7"
          strokeWidth={stroke}
        />
        {items.map((item) => {
          const len = ((item.count || 0) / total) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={item.key}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 90 90)"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <ul className="an-donut__legend">
        {items.map((item) => (
          <li key={item.key}>
            <span className="an-swatch" style={{ background: item.color }} />
            <span className="an-donut__label">{item.label}</span>
            <strong>{formatNumber(item.count)}</strong>
            <em>{item.percent}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChannelBars({ items = [] }) {
  const max = Math.max(1, ...items.map((i) => i.count || 0));
  return (
    <div className="an-bars">
      <div className="an-bars__plot">
        {items.map((item) => (
          <div key={item.key} className="an-bars__col">
            <div className="an-bars__track">
              <div
                className="an-bars__fill"
                style={{
                  height: `${Math.max(4, ((item.count || 0) / max) * 100)}%`,
                  background: item.color,
                }}
                title={`${item.label}: ${item.count}`}
              />
            </div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <ul className="an-bars__legend">
        {items.map((item) => (
          <li key={item.key}>
            <span className="an-swatch" style={{ background: item.color }} />
            {item.label}
            <strong>{formatNumber(item.count)}</strong>
            <em>{item.percent}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PriorityBars({ items = [], avgRate = 0 }) {
  return (
    <div className="an-priority">
      {items.map((item) => (
        <div key={item.key} className="an-priority__row">
          <div className="an-priority__meta">
            <span>{item.label}</span>
            <strong>
              {formatNumber(item.count)} · {item.percent}%
            </strong>
          </div>
          <div className="an-priority__track">
            <span
              style={{
                width: `${Math.max(item.percent || 0, item.count ? 4 : 0)}%`,
                background: item.color,
              }}
            />
          </div>
        </div>
      ))}
      <div className="an-priority__avg">
        <div className="an-priority__meta">
          <span>Avg resolution rate</span>
          <strong>{avgRate}%</strong>
        </div>
        <div className="an-priority__track an-priority__track--avg">
          <span style={{ width: `${Math.max(avgRate || 0, avgRate ? 4 : 0)}%` }} />
        </div>
      </div>
    </div>
  );
}

function exportCsv(data, periodLabel) {
  const rows = [
    ["Metric", "Value"],
    ["Period", periodLabel],
    ["Total tickets", data.kpis.totalTickets.value],
    ["Open tickets", data.kpis.openTickets.value],
    ["Resolved", data.kpis.resolved.value],
    ["Resolution rate %", data.kpis.resolutionRate.value],
    [],
    ["Agent", "Total", "Resolved", "Open", "Pending", "Resolution rate %"],
    ...data.topAgents.map((a) => [
      a.name,
      a.total,
      a.resolved,
      a.open,
      a.pending,
      a.resolutionRate,
    ]),
  ];
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `help-center-pro-analytics-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Analytics() {
  const [period, setPeriod] = useState("7d");
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getTicketAnalytics(period);
        if (!cancelled) setData(res?.data || EMPTY);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load analytics");
          setData(EMPTY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const periodLabel = useMemo(
    () => PERIODS.find((p) => p.key === period)?.label || "Last 7 days",
    [period]
  );

  const kpis = [
    {
      key: "total",
      label: "Total Tickets",
      value: data.kpis.totalTickets.value,
      change: data.kpis.totalTickets.changePercent,
      icon: Ticket,
      tone: "blue",
    },
    {
      key: "open",
      label: "Open Tickets",
      value: data.kpis.openTickets.value,
      change: data.kpis.openTickets.changePercent,
      icon: CircleDot,
      tone: "green",
    },
    {
      key: "resolved",
      label: "Resolved",
      value: data.kpis.resolved.value,
      change: data.kpis.resolved.changePercent,
      icon: Clock3,
      tone: "violet",
    },
    {
      key: "rate",
      label: "Resolution Rate",
      value: `${data.kpis.resolutionRate.value}%`,
      change: data.kpis.resolutionRate.changePercent,
      icon: CheckCircle2,
      tone: "amber",
    },
  ];

  return (
    <div className="analytics">
      <header className="analytics__hero">
        <div>
          <h1>Analytics</h1>
          <p>Monitor volume, resolution rates, and team performance.</p>
        </div>
        <div className="analytics__controls">
          <div className="analytics__periods" role="tablist" aria-label="Time period">
            {PERIODS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={period === item.key}
                className={period === item.key ? "is-active" : ""}
                onClick={() => setPeriod(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => exportCsv(data, periodLabel)}
            disabled={loading}
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </header>

      {error ? <p className="analytics__error">{error}</p> : null}

      <section className="analytics__kpis" aria-label="Key metrics">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.key} className={`an-kpi an-kpi--${kpi.tone}`}>
              <div className="an-kpi__top">
                <p>{kpi.label}</p>
                <span className={`an-kpi__icon an-kpi__icon--${kpi.tone}`}>
                  <Icon size={18} />
                </span>
              </div>
              <div className="an-kpi__value">
                {loading ? "—" : typeof kpi.value === "number" ? formatNumber(kpi.value) : kpi.value}
              </div>
              <p className={`an-kpi__change ${changeClass(kpi.change)}`}>
                {formatChange(kpi.change)}
              </p>
            </article>
          );
        })}
      </section>

      <section className="an-panel an-panel--volume">
        <div className="an-panel__head">
          <h2>Ticket volume over time</h2>
          <div className="an-legend">
            <span>
              <i className="dot-created" /> Created
            </span>
            <span>
              <i className="dot-resolved" /> Resolved
            </span>
            <span>
              <i className="dot-pending" /> Pending
            </span>
          </div>
        </div>
        {loading ? (
          <div className="analytics__loading">
            <Loader2 className="workspace-spin" size={22} />
            Loading volume…
          </div>
        ) : (
          <VolumeLineChart series={data.volumeOverTime} />
        )}
      </section>

      <section className="analytics__breakdowns">
        <article className="an-panel">
          <div className="an-panel__head">
            <h2>Status breakdown</h2>
          </div>
          <StatusDonut items={data.statusBreakdown} />
        </article>
        <article className="an-panel">
          <div className="an-panel__head">
            <h2>Channel breakdown</h2>
          </div>
          <ChannelBars items={data.channelBreakdown} />
        </article>
        <article className="an-panel">
          <div className="an-panel__head">
            <h2>Priority breakdown</h2>
          </div>
          <PriorityBars
            items={data.priorityBreakdown}
            avgRate={data.avgResolutionRate || 0}
          />
        </article>
      </section>

      <section className="an-panel an-panel--agents">
        <div className="an-panel__head">
          <h2>Top Agents</h2>
          <p>Performance breakdown by agent</p>
        </div>
        {data.topAgents.length ? (
          <div className="an-agents">
            <div className="an-agents__head">
              <span>Agent</span>
              <span>Total</span>
              <span>Resolved</span>
              <span>Open</span>
              <span>Pending</span>
              <span>Resolution Rate</span>
            </div>
            {data.topAgents.map((agent, index) => (
              <div key={agent.userId || agent.name} className="an-agents__row">
                <div className="an-agents__who">
                  <span className={`an-agents__avatar ${AGENT_TONES[index % AGENT_TONES.length]}`}>
                    {agent.initials}
                  </span>
                  <strong>{agent.name}</strong>
                </div>
                <span>{formatNumber(agent.total)}</span>
                <span className="is-resolved">{formatNumber(agent.resolved)}</span>
                <span className="is-open">{formatNumber(agent.open)}</span>
                <span className="is-pending">{formatNumber(agent.pending)}</span>
                <div className="an-agents__rate">
                  <div className="an-agents__bar">
                    <span style={{ width: `${agent.resolutionRate || 0}%` }} />
                  </div>
                  <em>{agent.resolutionRate || 0}%</em>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="analytics__empty">
            {loading
              ? "Loading agent performance…"
              : "No assigned ticket activity in this period yet."}
          </p>
        )}
      </section>
    </div>
  );
}
