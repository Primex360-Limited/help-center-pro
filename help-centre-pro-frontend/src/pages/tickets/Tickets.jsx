import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/client.js";
import { formatNumber, priorityLabel, statusLabel } from "../../utils/format.js";
import "../../styles/app.css";
import "../../styles/dashboard.css";

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

export default function Tickets() {
  const location = useLocation();
  const [params] = useSearchParams();
  const query = (params.get("q") || "").trim().toLowerCase();

  const [tickets, setTickets] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [notice] = useState(location.state?.notice || "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await apiRequest("/tickets?page=1&limit=50", {
          method: "GET",
          auth: true,
        });
        if (!cancelled) {
          setTickets(result?.data?.tickets || []);
          setMeta(result?.meta || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load tickets");
          setTickets([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query) return tickets;
    return tickets.filter((ticket) => {
      const haystack = [
        ticket.ticketId,
        ticket.title,
        ticket.description,
        ticket.customer?.name,
        ticket.customer?.email,
        ticket.assignedTo?.name,
        ticket.status,
        ticket.priority,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [tickets, query]);

  return (
    <div className="dashboard">
      <header className="dashboard__hero" style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1>Tickets</h1>
          <p>
            {meta?.total != null
              ? `${formatNumber(meta.total)} tickets in your workspace`
              : "Live tickets from your workspace"}
            {query ? ` · filtered by “${query}”` : ""}
          </p>
        </div>
        <Link to="/tickets/new" className="primary-btn" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          New Ticket
        </Link>
      </header>

      {notice ? <p className="auth-success" style={{ margin: 0 }}>{notice}</p> : null}
      {error ? <p className="dashboard__error">{error}</p> : null}

      <section className="dash-panel dash-panel--tickets">
        {loading ? (
          <p className="dash-empty">Loading tickets...</p>
        ) : filtered.length ? (
          <ul className="recent-tickets">
            {filtered.map((ticket) => (
              <li key={ticket.id} className="recent-tickets__row">
                <div className="recent-tickets__main">
                  <div className="recent-tickets__meta">
                    <span className="recent-tickets__id">{ticket.ticketId}</span>
                  </div>
                  <h3>{ticket.title}</h3>
                  <p>
                    {(ticket.customer?.name ||
                      ticket.assignedTo?.name ||
                      ticket.createdBy?.name ||
                      "Unknown") +
                      (ticket.createdAt
                        ? ` · ${new Date(ticket.createdAt).toLocaleString()}`
                        : "")}
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
            {query
              ? "No tickets match your search."
              : "No tickets in your workspace yet. Create the first one."}
          </p>
        )}
      </section>
    </div>
  );
}
