import { useEffect, useState } from "react";
import {
  Briefcase,
  Clock3,
  CheckCircle2,
  Users,
  UserRound,
  ChevronDown,
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
    openTickets: { value: 0, label: "Open Tickets", periodLabel: "Live" },
    pending: { value: 0, label: "Pending", periodLabel: "Live" },
    resolvedToday: { value: 0, label: "Resolved Today", periodLabel: "Today" },
    totalCustomers: { value: 0, label: "Total Customers", periodLabel: "All time" },
    activeAgents: { value: 0, label: "Active agents", periodLabel: "Live" },
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

function MetricCard({ title, value, periodLabel, icon: Icon, tone }) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <p className="metric-card__label">{title}</p>
        <div className={`metric-card__icon metric-card__icon--${tone}`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
      </div>
      <div className="metric-card__value">{formatNumber(value)}</div>
      <button type="button" className="metric-card__period" disabled>
        {periodLabel || "Today"}
        <ChevronDown size={14} />
      </button>
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
  const summary = { ...EMPTY_OVERVIEW.summary, ...(overview.summary || {}) };
  const agents = overview.topAgentsToday?.agents || [];
  const recent = overview.recentTickets || [];

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
          periodLabel={summary.openTickets.periodLabel}
          icon={Briefcase}
          tone="orange"
        />
        <MetricCard
          title={summary.pending.label}
          value={summary.pending.value}
          periodLabel={summary.pending.periodLabel}
          icon={Clock3}
          tone="amber"
        />
        <MetricCard
          title={summary.resolvedToday.label}
          value={summary.resolvedToday.value}
          periodLabel={summary.resolvedToday.periodLabel}
          icon={CheckCircle2}
          tone="green"
        />
        <MetricCard
          title={summary.totalCustomers.label}
          value={summary.totalCustomers.value}
          periodLabel={summary.totalCustomers.periodLabel}
          icon={Users}
          tone="violet"
        />
        <MetricCard
          title={summary.activeAgents.label}
          value={summary.activeAgents.value}
          periodLabel={summary.activeAgents.periodLabel}
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
