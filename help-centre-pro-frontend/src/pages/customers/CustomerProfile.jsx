import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Mail,
  Phone,
} from "lucide-react";
import { getCustomerProfile } from "../../api/customers.api.js";
import { channelTicketPath } from "../tickets/channelUtils.js";
import "../../styles/customers.css";

function initials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const CHANNEL_TAG = {
  EMAIL: { label: "Email", className: "is-email" },
  CHAT: { label: "Live chat", className: "is-chat" },
  PHONE: { label: "Call", className: "is-call" },
};

const STATUS_TAG = {
  OPEN: { label: "open", className: "is-open" },
  QUEUED: { label: "queued", className: "is-open" },
  PENDING: { label: "pending", className: "is-pending" },
  WAITING_FOR_REPLY: { label: "pending", className: "is-pending" },
  RESOLVED: { label: "resolved", className: "is-resolved" },
  CLOSED: { label: "closed", className: "is-closed" },
};

/** Customer Profile — every figure computed from this customer's real tickets. */
export default function CustomerProfile() {
  const { customerKey } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await getCustomerProfile(customerKey);
        setCustomer(res?.data?.customer || null);
        setTickets(res?.data?.tickets || []);
      } catch (err) {
        setError(err.message || "Unable to load this customer");
      } finally {
        setLoading(false);
      }
    })();
  }, [customerKey]);

  if (loading) {
    return (
      <div className="cust-page">
        <p className="cust-loading">
          <Loader2 size={16} className="cust-spin" /> Loading customer…
        </p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="cust-page">
        <button type="button" className="cust-back" onClick={() => navigate("/customers")}>
          <ArrowLeft size={14} /> Back
        </button>
        <p className="cust-error">{error || "Customer not found"}</p>
      </div>
    );
  }

  const stats = customer.stats || {
    totalTickets: customer.ticketCount,
    open: 0,
    resolved: 0,
    pending: 0,
  };

  return (
    <div className="cust-page">
      <h1 className="cust-title">Customer Profile</h1>

      <button type="button" className="cust-back" onClick={() => navigate("/customers")}>
        <ArrowLeft size={14} /> Back
      </button>

      <header className="cust-profile-head">
        <span className="cust-avatar cust-avatar--lg" aria-hidden="true">
          {initials(customer.name)}
        </span>
        <div className="cust-profile-head__main">
          <h2>{customer.name}</h2>
          {customer.company ? <p className="cust-company">{customer.company}</p> : null}
          <p className="cust-profile-contacts">
            {customer.email ? (
              <span>
                <Mail size={13} /> {customer.email}
              </span>
            ) : null}
            {customer.phone ? (
              <span>
                <Phone size={13} /> {customer.phone}
              </span>
            ) : null}
          </p>
        </div>
        <span className="cust-last-seen">
          <CalendarDays size={14} /> Last seen{" "}
          {customer.lastSeenAt
            ? new Date(customer.lastSeenAt).toISOString().slice(0, 10)
            : "—"}
        </span>
      </header>

      <h3 className="cust-overview-title">Overview</h3>
      <div className="cust-stat-grid">
        <div className="cust-stat">
          <span>Total tickets</span>
          <strong className="cust-stat__value is-red">{stats.totalTickets}</strong>
        </div>
        <div className="cust-stat">
          <span>Open</span>
          <strong className="cust-stat__value is-blue">{stats.open}</strong>
        </div>
        <div className="cust-stat">
          <span>Resolved</span>
          <strong className="cust-stat__value is-green">{stats.resolved}</strong>
        </div>
        <div className="cust-stat">
          <span>Pending</span>
          <strong className="cust-stat__value is-amber">{stats.pending}</strong>
        </div>
      </div>

      <div className="cust-ticket-list">
        {tickets.map((ticket) => {
          const channelTag = CHANNEL_TAG[ticket.channel] || null;
          const statusTag = STATUS_TAG[ticket.status] || {
            label: String(ticket.status || "").toLowerCase(),
            className: "is-open",
          };
          return (
            <button
              key={ticket.ticketId}
              type="button"
              className="cust-ticket-card"
              onClick={() => navigate(channelTicketPath(ticket))}
            >
              <span className="cust-ticket-card__top">
                <span className="cust-ticket-card__id">#{ticket.ticketId}</span>
                {channelTag ? (
                  <span className={`cust-tag ${channelTag.className}`}>{channelTag.label}</span>
                ) : null}
                <span className={`cust-status-pill ${statusTag.className}`}>{statusTag.label}</span>
              </span>
              <span className="cust-ticket-card__title">{ticket.title}</span>
              <span className="cust-ticket-card__date">{formatDate(ticket.createdAt)}</span>
            </button>
          );
        })}
        {tickets.length === 0 ? (
          <p className="cust-empty">No tickets for this customer yet.</p>
        ) : null}
      </div>
    </div>
  );
}
