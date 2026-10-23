import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Loader2,
  UserRound,
  X,
} from "lucide-react";
import { getAssignableAgents, transferTicket } from "../../api/tickets.api.js";
import "../../styles/assign.css";

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

const AVATAR_COLORS = ["#7a5af8", "#1570ef", "#dc6803", "#027a48", "#c11574", "#175cd3"];
function avatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const ASSIGNMENT_REASONS = [
  "Expertise match",
  "Workload balance",
  "Customer request",
  "Follow-up required",
  "Escalation",
  "Reassignment",
];

/**
 * Assign Ticket — exact match to "Select assignee" design.
 * Assigns the ticket to an individual agent with optional reason/note.
 */
export default function AssignTicketModal({ ticket, onClose, onAssigned }) {
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [notifyAgent, setNotifyAgent] = useState(true);
  const [addToActiveQueue, setAddToActiveQueue] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);

  const agentMenuRef = useRef(null);
  const reasonMenuRef = useRef(null);
  const ticketId = ticket?.ticketId || ticket?.id;

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
        if (!cancelled) setError(err.message || "Unable to load agents");
      } finally {
        if (!cancelled) setLoadingAgents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onPointerDown(e) {
      if (agentMenuRef.current && !agentMenuRef.current.contains(e.target)) {
        setAgentDropdownOpen(false);
      }
      if (reasonMenuRef.current && !reasonMenuRef.current.contains(e.target)) {
        setReasonDropdownOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setAgentDropdownOpen(false);
        setReasonDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || null,
    [agents, selectedAgentId]
  );

  function presenceOf(agent) {
    if (!agent) return { label: "Offline", className: "is-offline" };
    if (agent.presence === "available" || agent.isOnline) {
      return { label: "Online", className: "is-online" };
    }
    if (agent.presence === "busy") {
      return { label: "Busy", className: "is-busy" };
    }
    return { label: "Offline", className: "is-offline" };
  }

  async function handleAssign() {
    setError("");
    if (!selectedAgent) {
      setError("Please select an agent to assign this ticket to.");
      return;
    }
    setSubmitting(true);
    try {
      await transferTicket(ticketId, {
        assignedToUserId: selectedAgent.id,
        transferReason:
          [assignmentReason, internalNote.trim()].filter(Boolean).join(" — ") ||
          "Ticket assignment",
        notifyCustomer: false,
        addInternalNote: Boolean(internalNote.trim()) || notifyAgent,
        keepAsFollower: false,
      });
      onAssigned?.(selectedAgent);
    } catch (err) {
      setError(err.message || "Unable to assign this ticket");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ticket) return null;

  const selectedPresence = presenceOf(selectedAgent);

  return createPortal(
    <div
      className="as-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="as-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="as-modal">
        <header className="as-head">
          <h2 id="as-title">Select assignee</h2>
          <button
            type="button"
            className="as-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="as-assign-to">
          <span className="as-section-label">Assign to</span>
          <div className="as-type-card is-selected" role="radio" aria-checked="true">
            <span className="as-type-card__icon" aria-hidden="true">
              <UserRound size={18} />
            </span>
            <span className="as-type-card__text">
              <strong>Agent</strong>
              <small>Assign ticket to an individual agent.</small>
            </span>
          </div>
        </div>

        <div className="as-field">
          <label className="as-label" id="as-agent-label">
            Select agent<span className="as-required">*</span>
          </label>
          <div
            className={`as-dropdown${agentDropdownOpen ? " is-open" : ""}`}
            ref={agentMenuRef}
          >
            <button
              type="button"
              className="as-dropdown__trigger"
              aria-labelledby="as-agent-label"
              aria-haspopup="listbox"
              aria-expanded={agentDropdownOpen}
              onClick={() => {
                setAgentDropdownOpen((v) => !v);
                setReasonDropdownOpen(false);
              }}
              disabled={loadingAgents}
            >
              {selectedAgent ? (
                <span className="as-agent-chip">
                  <span
                    className="as-avatar"
                    style={{ background: avatarColor(selectedAgent.name) }}
                  >
                    {initials(selectedAgent.name)}
                  </span>
                  <span className="as-agent-chip__name">{selectedAgent.name}</span>
                  <span className={`as-presence ${selectedPresence.className}`}>
                    <i /> {selectedPresence.label}
                  </span>
                </span>
              ) : (
                <span className="as-dropdown__placeholder">
                  {loadingAgents ? "Loading agents…" : "Select agent"}
                </span>
              )}
              <ChevronDown size={16} className="as-dropdown__chevron" />
            </button>
            {agentDropdownOpen ? (
              <ul className="as-dropdown__menu" role="listbox">
                {agents.length === 0 ? (
                  <li className="as-dropdown__empty">No assignable agents found.</li>
                ) : (
                  agents.map((agent) => {
                    const presence = presenceOf(agent);
                    return (
                      <li key={agent.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedAgentId === agent.id}
                          className={`as-dropdown__item${
                            selectedAgentId === agent.id ? " is-selected" : ""
                          }`}
                          onClick={() => {
                            setSelectedAgentId(agent.id);
                            setAgentDropdownOpen(false);
                          }}
                        >
                          <span
                            className="as-avatar"
                            style={{ background: avatarColor(agent.name) }}
                          >
                            {initials(agent.name)}
                          </span>
                          <span className="as-dropdown__item-main">
                            <strong>{agent.name}</strong>
                            <small>
                              {agent.expertise || agent.role || "Support"}
                              {typeof agent.openTickets === "number"
                                ? ` · ${agent.openTickets} open`
                                : ""}
                            </small>
                          </span>
                          <span className={`as-presence ${presence.className}`}>
                            <i /> {presence.label}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="as-field">
          <label className="as-label" id="as-reason-label">
            Reason for assignment <span className="as-optional">(optional)</span>
          </label>
          <div
            className={`as-dropdown${reasonDropdownOpen ? " is-open" : ""}`}
            ref={reasonMenuRef}
          >
            <button
              type="button"
              className="as-dropdown__trigger"
              aria-labelledby="as-reason-label"
              aria-haspopup="listbox"
              aria-expanded={reasonDropdownOpen}
              onClick={() => {
                setReasonDropdownOpen((v) => !v);
                setAgentDropdownOpen(false);
              }}
            >
              <span
                className={
                  assignmentReason
                    ? "as-dropdown__value"
                    : "as-dropdown__placeholder"
                }
              >
                {assignmentReason || "Select a reason"}
              </span>
              <ChevronDown size={16} className="as-dropdown__chevron" />
            </button>
            {reasonDropdownOpen ? (
              <ul className="as-dropdown__menu" role="listbox">
                {ASSIGNMENT_REASONS.map((reason) => (
                  <li key={reason}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={assignmentReason === reason}
                      className={`as-dropdown__item${
                        assignmentReason === reason ? " is-selected" : ""
                      }`}
                      onClick={() => {
                        setAssignmentReason(reason);
                        setReasonDropdownOpen(false);
                      }}
                    >
                      {reason}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="as-field">
          <label className="as-label" htmlFor="as-note">
            Add internal note <span className="as-optional">(optional)</span>
          </label>
          <div className="as-textarea-wrap">
            <textarea
              id="as-note"
              rows={4}
              maxLength={500}
              placeholder="Add a note for the assigned agent..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
            />
            <span className="as-counter">{internalNote.length}/500</span>
          </div>
        </div>

        <div className="as-settings">
          <h3 className="as-settings__title">Assignment settings</h3>
          <label className="as-check">
            <input
              type="checkbox"
              checked={notifyAgent}
              onChange={(e) => setNotifyAgent(e.target.checked)}
            />
            <span className="as-check__box">
              {notifyAgent ? <Check size={12} strokeWidth={3.5} /> : null}
            </span>
            <span className="as-check__copy">
              <strong>Notify agent about this assignment</strong>
              <small>Send an email and in-app notification to the assigned agent</small>
            </span>
          </label>
          <label className="as-check">
            <input
              type="checkbox"
              checked={addToActiveQueue}
              onChange={(e) => setAddToActiveQueue(e.target.checked)}
            />
            <span className="as-check__box">
              {addToActiveQueue ? <Check size={12} strokeWidth={3.5} /> : null}
            </span>
            <span className="as-check__copy">
              <strong>Add agents active queue</strong>
              <small>Ticket will appear in the agent&apos;s active ticket first</small>
            </span>
          </label>
        </div>

        {error ? (
          <p className="as-error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="as-footer">
          <button
            type="button"
            className="as-btn as-btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="as-btn as-btn--primary"
            onClick={handleAssign}
            disabled={submitting || !selectedAgent}
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="as-spin" /> Assigning…
              </>
            ) : (
              "Assign ticket"
            )}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
