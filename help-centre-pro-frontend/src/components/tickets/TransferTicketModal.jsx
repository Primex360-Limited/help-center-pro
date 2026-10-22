import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Ticket as TicketIcon,
  X,
} from "lucide-react";
import { getAssignableAgents, transferTicket } from "../../api/tickets.api.js";
import "../../styles/transfer.css";

const CHANNEL_META = {
  CHAT: { label: "Live chat", Icon: MessageSquare },
  EMAIL: { label: "Email", Icon: Mail },
  PHONE: { label: "Call", Icon: Phone },
  MANUAL: { label: "Manual", Icon: TicketIcon },
};

const PRESENCE_META = {
  available: { label: "Available", className: "is-available" },
  busy: { label: "Busy", className: "is-busy" },
  offline: { label: "Offline", className: "is-offline" },
};

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

const AVATAR_COLORS = ["#7a5af8", "#1570ef", "#dc6803", "#027a48", "#c11574", "#175cd3"];
function avatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function Avatar({ name, size = 34 }) {
  return (
    <span
      className="tx-avatar"
      style={{ background: avatarColor(name), width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/**
 * Transfer Ticket — image-matched premium dialog.
 * Agent tab: pick a person. Department tab: pick a team (role) and the
 * least-loaded available member is chosen automatically. Channel tab is
 * informational: a ticket's channel is fixed by how the customer reached us.
 */
export default function TransferTicketModal({ ticket, onClose, onTransferred }) {
  const [tab, setTab] = useState("agent");
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [reason, setReason] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [addInternalNote, setAddInternalNote] = useState(true);
  const [keepAsFollower, setKeepAsFollower] = useState(false);
  const [priority, setPriority] = useState("keep");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const ticketId = ticket?.ticketId || ticket?.id;
  const channel = String(ticket?.channel || "MANUAL").toUpperCase();
  const ChannelIcon = (CHANNEL_META[channel] || CHANNEL_META.MANUAL).Icon;
  const currentAssignee = ticket?.assignedTo?.name || ticket?.assignedToName || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getAssignableAgents();
        if (cancelled) return;
        const list = (res?.data?.agents || []).map((a) => ({
          ...a,
          id: a.userId || a.id,
        }));
        setAgents(list);
      } catch (err) {
        if (!cancelled) setAgentsError(err.message || "Unable to load agents");
      } finally {
        if (!cancelled) setLoadingAgents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const departments = useMemo(() => {
    const map = new Map();
    agents.forEach((agent) => {
      const dept = agent.expertise || agent.role || "Support";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept).push(agent);
    });
    return [...map.entries()].map(([name, members]) => ({
      name,
      members,
      available: members.filter((m) => m.presence === "available").length,
    }));
  }, [agents]);

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = tab === "department" && selectedDept
      ? agents.filter((a) => (a.expertise || a.role || "Support") === selectedDept)
      : agents;
    if (!q) return pool;
    return pool.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) || a.expertise?.toLowerCase().includes(q)
    );
  }, [agents, search, tab, selectedDept]);

  const visibleAgents = showAll ? filteredAgents : filteredAgents.slice(0, 4);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null;

  function pickDepartment(dept) {
    setSelectedDept(dept.name);
    const best = [...dept.members].sort((a, b) => {
      const rank = (m) => (m.presence === "available" ? 0 : m.presence === "busy" ? 1 : 2);
      return rank(a) - rank(b) || (a.openTickets || 0) - (b.openTickets || 0);
    })[0];
    if (best) setSelectedAgentId(best.id);
  }

  async function handleTransfer() {
    setError("");
    if (!selectedAgent) {
      setError("Select an agent to transfer this ticket to.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Add a short reason for the transfer (at least 3 characters).");
      return;
    }
    setSubmitting(true);
    try {
      await transferTicket(ticketId, {
        assignedToUserId: selectedAgent.id,
        transferReason: reason.trim(),
        ...(priority !== "keep" ? { priority } : {}),
        notifyCustomer,
        addInternalNote,
        keepAsFollower,
      });
      onTransferred?.(selectedAgent);
    } catch (err) {
      setError(err.message || "Unable to transfer this ticket");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ticket) return null;

  return createPortal(
    <div
      className="tx-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="tx-modal">
        <header className="tx-head">
          <div>
            <h2 id="tx-title">Transfer Ticket</h2>
            <p>
              Transfer {ticketId} to another agent or department
            </p>
          </div>
          <button type="button" className="tx-close" onClick={onClose} disabled={submitting} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="tx-ticket-card">
          <div className="tx-ticket-card__top">
            <span className="tx-ticket-id">
              <TicketIcon size={13} /> {ticketId}
            </span>
            <span className="tx-ticket-channel">
              <ChannelIcon size={13} /> {(CHANNEL_META[channel] || CHANNEL_META.MANUAL).label}
            </span>
          </div>
          <p className="tx-ticket-title">{ticket.title || "Untitled ticket"}</p>
          <div className="tx-ticket-grid">
            <div>
              <span>Assignee</span>
              {currentAssignee ? (
                <strong className="tx-inline-agent">
                  <Avatar name={currentAssignee} size={20} /> {currentAssignee}
                </strong>
              ) : (
                <strong>Unassigned</strong>
              )}
            </div>
            <div>
              <span>Status</span>
              <strong className="tx-status">
                <i className="tx-dot tx-dot--open" /> {String(ticket.status || "OPEN").replace(/_/g, " ")}
              </strong>
            </div>
            <div>
              <span>Channel</span>
              <strong className="tx-inline-agent">
                <ChannelIcon size={13} /> {(CHANNEL_META[channel] || CHANNEL_META.MANUAL).label}
              </strong>
            </div>
          </div>
        </div>

        <div className="tx-tabs" role="tablist" aria-label="Transfer mode">
          {[
            ["agent", "Transfer to Agent"],
            ["department", "Transfer to department"],
            ["channel", "Change Channel"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`tx-tab${tab === key ? " is-active" : ""}`}
              onClick={() => setTab(key)}
            >
              <span className="tx-tab__radio" />
              {label}
            </button>
          ))}
        </div>

        {tab === "channel" ? (
          <div className="tx-channel-panel">
            <p>
              This ticket's channel is <strong>{(CHANNEL_META[channel] || CHANNEL_META.MANUAL).label}</strong> —
              it's set by how the customer contacted you and can't be changed
              mid-conversation. To continue on another channel, transfer the
              ticket to an agent and start a new conversation there.
            </p>
            <button type="button" className="tx-link-btn" onClick={() => setTab("agent")}>
              Transfer to an agent instead <ArrowRight size={13} />
            </button>
          </div>
        ) : (
          <>
            <span className="tx-label">
              {tab === "department" ? "Select a department" : "Select an agent"}
            </span>

            {tab === "agent" ? (
              <label className="tx-search">
                <Search size={15} />
                <input
                  type="search"
                  placeholder="Search agents by name or expertise…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            ) : null}

            {loadingAgents ? (
              <p className="tx-loading">
                <Loader2 size={15} className="tx-spin" /> Loading agents…
              </p>
            ) : agentsError ? (
              <p className="tx-error">{agentsError}</p>
            ) : tab === "department" ? (
              <ul className="tx-agent-list">
                {departments.map((dept) => (
                  <li key={dept.name}>
                    <button
                      type="button"
                      className={`tx-agent${selectedDept === dept.name ? " is-selected" : ""}`}
                      onClick={() => pickDepartment(dept)}
                    >
                      <span className="tx-agent__radio" />
                      <span className="tx-agent__main">
                        <strong>{dept.name}</strong>
                        <small>
                          {dept.members.length} agent{dept.members.length === 1 ? "" : "s"} ·{" "}
                          {dept.available} available
                        </small>
                      </span>
                      {selectedDept === dept.name && selectedAgent ? (
                        <span className="tx-agent__load">
                          → {selectedAgent.name} ({selectedAgent.openTickets} open)
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : visibleAgents.length === 0 ? (
              <p className="tx-loading">No agents match your search.</p>
            ) : (
              <ul className="tx-agent-list">
                {visibleAgents.map((agent) => {
                  const presence = PRESENCE_META[agent.presence] || PRESENCE_META.offline;
                  const selected = selectedAgentId === agent.id;
                  return (
                    <li key={agent.id}>
                      <button
                        type="button"
                        className={`tx-agent${selected ? " is-selected" : ""}`}
                        onClick={() => setSelectedAgentId(agent.id)}
                      >
                        <span className="tx-agent__radio" />
                        <Avatar name={agent.name} />
                        <span className="tx-agent__main">
                          <strong>{agent.name}</strong>
                          <small>{agent.expertise || agent.role || "Support"}</small>
                        </span>
                        <span className="tx-agent__side">
                          <span className={`tx-presence ${presence.className}`}>
                            <i /> {presence.label}
                          </span>
                          <small>
                            {agent.openTickets} open Ticket{agent.openTickets === 1 ? "" : "s"}
                          </small>
                        </span>
                        <span className="tx-agent__tags">
                          <span>{agent.expertise || agent.role || "Support"}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {tab === "agent" && filteredAgents.length > 4 ? (
              <button type="button" className="tx-view-all" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show fewer agents" : "View all agents"} <ChevronDown size={13} className={showAll ? "is-flipped" : ""} />
              </button>
            ) : null}
          </>
        )}

        <label className="tx-label" htmlFor="tx-reason">
          Reason for transfer <span className="tx-required">*</span>
        </label>
        <div className="tx-reason-wrap">
          <textarea
            id="tx-reason"
            rows={3}
            maxLength={500}
            placeholder="Explain why this ticket is being transferred…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <span className="tx-counter">{reason.length}/500</span>
        </div>

        <div className="tx-options">
          <div className="tx-checks">
            <label className="tx-check">
              <input type="checkbox" checked={notifyCustomer} onChange={(e) => setNotifyCustomer(e.target.checked)} />
              <span className="tx-check__box">{notifyCustomer ? <Check size={11} strokeWidth={3.5} /> : null}</span>
              Notify customer about transfer
            </label>
            <label className="tx-check">
              <input type="checkbox" checked={addInternalNote} onChange={(e) => setAddInternalNote(e.target.checked)} />
              <span className="tx-check__box">{addInternalNote ? <Check size={11} strokeWidth={3.5} /> : null}</span>
              Add internal note about transfer
            </label>
            <label className="tx-check">
              <input type="checkbox" checked={keepAsFollower} onChange={(e) => setKeepAsFollower(e.target.checked)} />
              <span className="tx-check__box">{keepAsFollower ? <Check size={11} strokeWidth={3.5} /> : null}</span>
              Keep me as follower
            </label>
          </div>
          <label className="tx-priority">
            <span>Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="keep">
                keep current priority ({String(ticket.priority || "MEDIUM").toLowerCase()})
              </option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </label>
        </div>

        <div className="tx-summary">
          <span className="tx-summary__label">Transfer summary</span>
          <div className="tx-summary__flow">
            <span className="tx-summary__who">
              {currentAssignee ? <Avatar name={currentAssignee} size={22} /> : null}
              <span>
                <strong>{currentAssignee || "Unassigned"}</strong>
                <small>From</small>
              </span>
            </span>
            <ArrowRight size={15} className="tx-summary__arrow" />
            <span className="tx-summary__who">
              {selectedAgent ? <Avatar name={selectedAgent.name} size={22} /> : null}
              <span>
                <strong>{selectedAgent?.name || "Select an agent"}</strong>
                <small>{selectedAgent ? `To · ${selectedAgent.expertise || selectedAgent.role || "Support"}` : "To"}</small>
              </span>
            </span>
          </div>
          <p className="tx-summary__reason">
            <span>Reason</span>
            {reason.trim() || "—"}
          </p>
        </div>

        {error ? <p className="tx-error">{error}</p> : null}

        <footer className="tx-footer">
          <button type="button" className="tx-cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="tx-submit" onClick={handleTransfer} disabled={submitting || tab === "channel"}>
            {submitting ? (
              <>
                <Loader2 size={15} className="tx-spin" /> Transferring…
              </>
            ) : (
              "Transfer Ticket"
            )}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
