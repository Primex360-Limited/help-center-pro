import { useEffect, useId, useRef, useState } from "react";
import {
  Briefcase,
  Clock3,
  CheckCircle2,
  Users,
  UserRound,
  ChevronDown,
  Check,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { getDashboardOverview } from "../../api/tickets.api.js";
import ChannelBarChart from "../../components/dashboard/ChannelBarChart.jsx";
import {
  formatNumber,
  formatTicketId,
  priorityLabel,
  statusLabel,
} from "../../utils/format.js";
import "../../styles/app.css";
import "../../styles/dashboard.css";

const AGENT_TONES = ["tone-blue", "tone-green", "tone-orange", "tone-violet"];

const EMPTY_OVERVIEW = {
  summary: {
    openTickets: {
      value: 0,
      label: "Open Tickets",
      periodKey: "live",
      periodLabel: "Live",
      periods: [
        { key: "live", label: "Live", value: 0 },
        { key: "today", label: "Today", value: 0 },
        { key: "7d", label: "Last 7 days", value: 0 },
        { key: "30d", label: "Last 30 days", value: 0 },
      ],
    },
    pending: {
      value: 0,
      label: "Pending",
      periodKey: "live",
      periodLabel: "Live",
      periods: [
        { key: "live", label: "Live", value: 0 },
        { key: "today", label: "Today", value: 0 },
        { key: "7d", label: "Last 7 days", value: 0 },
        { key: "30d", label: "Last 30 days", value: 0 },
      ],
    },
    resolvedToday: {
      value: 0,
      label: "Resolved",
      periodKey: "today",
      periodLabel: "Today",
      periods: [
        { key: "today", label: "Today", value: 0 },
        { key: "7d", label: "Last 7 days", value: 0 },
        { key: "30d", label: "Last 30 days", value: 0 },
        { key: "all", label: "All time", value: 0 },
      ],
    },
    totalCustomers: {
      value: 0,
      label: "Total Customers",
      periodKey: "all",
      periodLabel: "All time",
      periods: [
        { key: "all", label: "All time", value: 0 },
        { key: "30d", label: "Last 30 days", value: 0 },
        { key: "7d", label: "Last 7 days", value: 0 },
        { key: "today", label: "Today", value: 0 },
      ],
    },
    activeAgents: {
      value: 0,
      label: "Active agents",
      periodKey: "live",
      periodLabel: "Live",
      periods: [
        { key: "live", label: "Live", value: 0 },
        { key: "today", label: "Today", value: 0 },
        { key: "7d", label: "Last 7 days", value: 0 },
      ],
    },
  },
  ticketsByChannel: {
    title: "Tickets by Channel",
    series: [
      { key: "created", label: "Created", color: "#2E90FA" },
      { key: "resolved", label: "Resolved", color: "#12B76A" },
    ],
    channels: [
      { channel: "EMAIL", label: "Emails", created: 0, resolved: 0 },
      { channel: "CHAT", label: "Chat", created: 0, resolved: 0 },
      { channel: "PHONE", label: "Call", created: 0, resolved: 0 },
      { channel: "MANUAL", label: "Manual", created: 0, resolved: 0 },
    ],
  },
  topAgentsToday: { title: "Top agents today", agents: [] },
  recentTickets: [],
};

function resolveMetric(metric = {}) {
  const periods = Array.isArray(metric.periods) && metric.periods.length
    ? metric.periods
    : [{ key: "default", label: metric.periodLabel || "Today", value: metric.value ?? 0 }];
  const periodKey = metric.periodKey || periods[0].key;
  const selected = periods.find((p) => p.key === periodKey) || periods[0];
  return {
    label: metric.label || "",
    periods,
    periodKey: selected.key,
    periodLabel: selected.label,
    value: selected.value ?? 0,
  };
}

function MetricCard({ title, value, periods, periodKey, periodLabel, onPeriodChange, icon: Icon, tone }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const options = periods?.length
    ? periods
    : [{ key: "default", label: periodLabel || "Today", value }];

  useEffect(() => {
    if (!open) return undefined;

    function handlePointer(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKey(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function selectPeriod(option) {
    onPeriodChange?.(option.key);
    setOpen(false);
  }

  return (
    <article className={`metric-card metric-card--${tone} ${open ? "is-menu-open" : ""}`}>
      <div className="metric-card__top">
        <p className="metric-card__label">{title}</p>
        <div className={`metric-card__icon metric-card__icon--${tone}`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
      </div>
      <div className="metric-card__value" key={`${periodKey}-${value}`}>
        {formatNumber(value)}
      </div>
      <div className="metric-card__period-wrap" ref={rootRef}>
        <button
          type="button"
          className={`metric-card__period ${open ? "is-open" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span>{periodLabel || "Today"}</span>
          <ChevronDown size={14} className="metric-card__chevron" />
        </button>
        {open ? (
          <ul
            id={listId}
            className="metric-card__menu"
            role="listbox"
            aria-label={`${title} period`}
          >
            {options.map((option) => {
              const selected = option.key === periodKey;
              return (
                <li key={option.key} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    className={`metric-card__menu-item ${selected ? "is-selected" : ""}`}
                    onClick={() => selectPeriod(option)}
                  >
                    <span className="metric-card__menu-label">{option.label}</span>
                    <span className="metric-card__menu-value">
                      {formatNumber(option.value ?? 0)}
                    </span>
                    {selected ? <Check size={14} strokeWidth={2.6} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

function channelTone(channel) {
  if (channel === "EMAIL") return "email";
  if (channel === "CHAT") return "chat";
  if (channel === "PHONE") return "call";
  return "manual";
}

function statusTone(status) {
  if (status === "OPEN" || status === "QUEUED") return "open";
  if (status === "PENDING" || status === "WAITING_FOR_REPLY") return "pending";
  if (status === "RESOLVED") return "resolved";
  return "closed";
}

function priorityTone(priority) {
  if (priority === "HIGH") return "high";
  if (priority === "MEDIUM") return "medium";
  return "low";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [periodKeys, setPeriodKeys] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getDashboardOverview();
        if (!cancelled) {
          setOverview(result?.data || EMPTY_OVERVIEW);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load dashboard data");
          setOverview(EMPTY_OVERVIEW);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user?.firstName || "there";
  const summarySource = { ...EMPTY_OVERVIEW.summary, ...(overview.summary || {}) };

  const summary = Object.fromEntries(
    Object.entries(summarySource).map(([key, metric]) => {
      const base = resolveMetric(metric);
      const selectedKey = periodKeys[key] || base.periodKey;
      const selected =
        base.periods.find((p) => p.key === selectedKey) || base.periods[0];
      return [
        key,
        {
          ...base,
          periodKey: selected.key,
          periodLabel: selected.label,
          value: selected.value ?? 0,
        },
      ];
    })
  );

  const agents = overview.topAgentsToday?.agents || [];
  const recent = overview.recentTickets || [];

  function setMetricPeriod(metricKey, periodKey) {
    setPeriodKeys((prev) => ({ ...prev, [metricKey]: periodKey }));
  }

  return (
    <div className="dashboard">
      <header className="dashboard__hero">
        <div>
          <h1>
            Welcome Back {firstName}
          </h1>
          <p>Here&apos;s what your support desk looks like today</p>
        </div>
      </header>

      {error ? <p className="dashboard__error">{error}</p> : null}

      <section className="dashboard__metrics dashboard__metrics--five" aria-label="Support metrics">
        <MetricCard
          title={summary.openTickets.label}
          value={summary.openTickets.value}
          periods={summary.openTickets.periods}
          periodKey={summary.openTickets.periodKey}
          periodLabel={summary.openTickets.periodLabel}
          onPeriodChange={(key) => setMetricPeriod("openTickets", key)}
          icon={Briefcase}
          tone="orange"
        />
        <MetricCard
          title={summary.pending.label}
          value={summary.pending.value}
          periods={summary.pending.periods}
          periodKey={summary.pending.periodKey}
          periodLabel={summary.pending.periodLabel}
          onPeriodChange={(key) => setMetricPeriod("pending", key)}
          icon={Clock3}
          tone="amber"
        />
        <MetricCard
          title={summary.resolvedToday.label}
          value={summary.resolvedToday.value}
          periods={summary.resolvedToday.periods}
          periodKey={summary.resolvedToday.periodKey}
          periodLabel={summary.resolvedToday.periodLabel}
          onPeriodChange={(key) => setMetricPeriod("resolvedToday", key)}
          icon={CheckCircle2}
          tone="green"
        />
        <MetricCard
          title={summary.totalCustomers.label}
          value={summary.totalCustomers.value}
          periods={summary.totalCustomers.periods}
          periodKey={summary.totalCustomers.periodKey}
          periodLabel={summary.totalCustomers.periodLabel}
          onPeriodChange={(key) => setMetricPeriod("totalCustomers", key)}
          icon={Users}
          tone="violet"
        />
        <MetricCard
          title={summary.activeAgents.label}
          value={summary.activeAgents.value}
          periods={summary.activeAgents.periods}
          periodKey={summary.activeAgents.periodKey}
          periodLabel={summary.activeAgents.periodLabel}
          onPeriodChange={(key) => setMetricPeriod("activeAgents", key)}
          icon={UserRound}
          tone="blue"
        />
      </section>

      <section className="dashboard__mid">
        <article className="dash-panel dash-panel--chart">
          <div className="dash-panel__head">
            <h2>{overview.ticketsByChannel?.title || "Tickets by Channel"}</h2>
          </div>
          <ChannelBarChart
            channels={overview.ticketsByChannel?.channels || []}
            series={overview.ticketsByChannel?.series || []}
          />
          {!loading &&
          (overview.ticketsByChannel?.channels || []).every(
            (c) => !c.created && !c.resolved
          ) ? (
            <p className="dash-empty">No ticket channel activity recorded for today yet.</p>
          ) : null}
        </article>

        <article className="dash-panel dash-panel--agents">
          <div className="dash-panel__head">
            <h2>{overview.topAgentsToday?.title || "Top agents today"}</h2>
          </div>
          {agents.length ? (
            <ul className="agent-rank">
              {agents.map((agent, index) => (
                <li key={agent.userId || agent.rank} className="agent-rank__row">
                  <span className="agent-rank__pos">{agent.rank}</span>
                  <span className={`agent-rank__avatar ${AGENT_TONES[index % AGENT_TONES.length]}`}>
                    {agent.initials}
                  </span>
                  <div className="agent-rank__meta">
                    <div className="agent-rank__name">{agent.name}</div>
                    <div className="agent-rank__bar">
                      <span style={{ width: `${agent.progress || 0}%` }} />
                    </div>
                  </div>
                  <strong className="agent-rank__score">{agent.score}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-empty">No agent resolutions recorded today yet.</p>
          )}
        </article>
      </section>

      <section className="dash-panel dash-panel--tickets">
        <div className="dash-panel__head dash-panel__head--row">
          <h2>Recent Tickets</h2>
          <Link to="/tickets" className="dash-link">
            View All
          </Link>
        </div>

        {recent.length ? (
          <ul className="recent-tickets">
            {recent.map((ticket) => (
              <li key={ticket.id} className="recent-tickets__row">
                <div className="recent-tickets__main">
                  <div className="recent-tickets__meta">
                    <span className="recent-tickets__id">
                      {formatTicketId(ticket.ticketId)}
                    </span>
                    <span className={`chip chip--channel-${channelTone(ticket.channel)}`}>
                      {ticket.channelLabel}
                    </span>
                  </div>
                  <h3>{ticket.title}</h3>
                  <p>
                    {ticket.reporterName} · {ticket.relativeTime}
                  </p>
                </div>
                <div className="recent-tickets__tags">
                  <span className={`chip chip--status-${statusTone(ticket.status)}`}>
                    {statusLabel(ticket.status)}
                  </span>
                  <span className={`chip chip--priority-${priorityTone(ticket.priority)}`}>
                    {priorityLabel(ticket.priority)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dash-empty">
            {loading ? "Loading live tickets..." : "No tickets in the database yet."}
          </p>
        )}
      </section>
    </div>
  );
}
