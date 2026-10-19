import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Forward,
  Lock,
  Mail,
  MoreHorizontal,
  Reply,
  Search,
  Send,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  addInternalNote,
  assignTicket,
  getInternalNotes,
  getMessages,
  getTicket,
  getTicketThread,
  listTickets,
  replyTicketEmail,
  updateTicketPriority,
  updateTicketStatus,
} from "../../api/tickets.api.js";
import { listUsers } from "../../api/users.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatTicketId, priorityLabel, statusLabel } from "../../utils/format.js";
import {
  avatarTone,
  customerEmail,
  customerName,
  formatDateTime,
  formatRelative,
  initialsFromName,
  previewText,
  PRIORITY_OPTIONS,
  priorityTone,
  statusOptionsFor,
  statusTone,
  unwrapThread,
} from "./channelUtils.js";
import "../../styles/channels.css";

function isAgentActor(actor, message, ticket, currentUserId) {
  if (actor?.type === "AGENT") return true;
  if (actor?.type === "CUSTOMER") return false;
  const senderId = message?.sender?.userId || actor?.userId;
  const custEmail = String(ticket?.customer?.email || "").toLowerCase();
  const senderEmail = String(
    message?.sender?.email || actor?.email || ""
  ).toLowerCase();
  if (custEmail && senderEmail && custEmail === senderEmail) return false;
  if (currentUserId && senderId === currentUserId) return true;
  if (ticket?.assignedTo?.userId && senderId === ticket.assignedTo.userId) {
    return true;
  }
  return Boolean(senderId);
}

function normalizeThreadMessages(messages, thread, ticket, currentUserId) {
  const fromMessages = (messages || []).map((message) => ({
    id: message.id,
    kind: "message",
    name: message.sender?.name || "Unknown",
    email: message.sender?.email || "",
    content:
      typeof message.content === "string"
        ? message.content
        : message.content?.body || "",
    createdAt: message.createdAt,
    isAgent: isAgentActor(null, message, ticket, currentUserId),
  }));

  const fromThread = (thread || [])
    .filter((event) => {
      const type = String(event?.type || "").toUpperCase();
      return type === "EMAIL" || type === "CHAT" || type === "LOG";
    })
    .map((event) => {
      const content = event.content;
      const body =
        typeof content === "string"
          ? content
          : content?.body || content?.subject || "";
      return {
        id: event.id,
        kind: "event",
        name: event.actor?.name || (content?.fromEmail ? "Customer" : "System"),
        email: event.actor?.email || content?.fromEmail || "",
        content: body,
        createdAt: event.createdAt,
        isAgent: isAgentActor(event.actor, null, ticket, currentUserId),
      };
    })
    .filter((row) => row.content);

  const merged = [...fromMessages];
  const seen = new Set(fromMessages.map((m) => `${m.content}|${m.createdAt}`));
  fromThread.forEach((row) => {
    const key = `${row.content}|${row.createdAt}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(row);
  });

  return merged.sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
}

export default function EmailsInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const selectedParam = params.get("ticket") || "";
  const viewParam = params.get("view") || "";

  const [tickets, setTickets] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(selectedParam);
  const [mode, setMode] = useState(viewParam === "thread" ? "thread" : "inbox");
  const [ticketDetail, setTicketDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [thread, setThread] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [agents, setAgents] = useState([]);
  const [composerTab, setComposerTab] = useState("reply");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState(location.state?.notice || "");
  const [menuOpen, setMenuOpen] = useState(false);

  const loadEmails = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const result = await listTickets({
        channel: "EMAIL",
        page: 1,
        limit: 100,
      });
      const rows = (result?.data?.tickets || []).sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt) -
          new Date(a.updatedAt || a.createdAt)
      );
      setTickets(rows);
    } catch (err) {
      setListError(err.message || "Unable to load email tickets");
      setTickets([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await listUsers();
        if (cancelled) return;
        setAgents(result?.data?.users || result?.data || []);
      } catch {
        if (!cancelled) setAgents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (location.state?.notice) {
      setBanner(location.state.notice);
      navigate(location.pathname + location.search, {
        replace: true,
        state: {},
      });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (selectedParam) {
      setSelectedId(selectedParam);
    }
    if (viewParam === "thread") {
      setMode("thread");
    }
  }, [selectedParam, viewParam]);

  const selectedTicket = useMemo(() => {
    const fromList =
      tickets.find((t) => t.ticketId === selectedId || t.id === selectedId) ||
      null;
    if (ticketDetail && (ticketDetail.ticketId === selectedId || ticketDetail.id === selectedId)) {
      return ticketDetail;
    }
    return fromList;
  }, [tickets, selectedId, ticketDetail]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((ticket) => {
      const hay = [
        ticket.ticketId,
        ticket.title,
        ticket.description,
        ticket.customer?.name,
        ticket.customer?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tickets, searchQuery]);

  const loadDetail = useCallback(
    async (ticketId) => {
      if (!ticketId) return;
      setLoadingDetail(true);
      setDetailError("");
      try {
        const [ticketRes, messagesRes, notesRes, threadRes] =
          await Promise.all([
            getTicket(ticketId),
            getMessages(ticketId, { page: 1, limit: 100 }).catch(() => null),
            getInternalNotes(ticketId, { page: 1, limit: 100 }).catch(() => null),
            getTicketThread(ticketId).catch(() => null),
          ]);
        const ticket = ticketRes?.data?.ticket || ticketRes?.data || null;
        setTicketDetail(ticket);
        setMessages(messagesRes?.data?.messages || []);
        setNotes(notesRes?.data?.messages || notesRes?.data?.notes || []);
        setThread(unwrapThread(threadRes));
      } catch (err) {
        setDetailError(err.message || "Unable to load ticket");
        setTicketDetail(null);
        setMessages([]);
        setNotes([]);
        setThread([]);
      } finally {
        setLoadingDetail(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    }
  }, [selectedId, loadDetail]);

  function selectTicket(ticketId) {
    setSelectedId(ticketId);
    setMode("inbox");
    setMenuOpen(false);
    const next = new URLSearchParams(params);
    next.set("ticket", ticketId);
    next.delete("view");
    setParams(next, { replace: true });
  }

  function openThread() {
    if (!selectedId) return;
    setMode("thread");
    const next = new URLSearchParams(params);
    next.set("ticket", selectedId);
    next.set("view", "thread");
    setParams(next, { replace: true });
  }

  function backToInbox() {
    setMode("inbox");
    const next = new URLSearchParams(params);
    next.delete("view");
    setParams(next, { replace: true });
  }

  async function handleStatusChange(status) {
    if (!selectedId || !status) return;
    if (status === selectedTicket?.status) return;
    setDetailError("");
    try {
      await updateTicketStatus(selectedId, status);
      await Promise.all([loadDetail(selectedId), loadEmails()]);
      setBanner("Status updated");
    } catch (err) {
      setDetailError(err.message || "Unable to update status");
    }
  }

  async function handlePriorityChange(priority) {
    if (!selectedId || !priority) return;
    if (priority === selectedTicket?.priority) return;
    setDetailError("");
    try {
      await updateTicketPriority(selectedId, priority);
      await Promise.all([loadDetail(selectedId), loadEmails()]);
      setBanner("Priority updated");
    } catch (err) {
      setDetailError(err.message || "Unable to update priority");
    }
  }

  async function handleAssignChange(userId) {
    if (!selectedId || !userId) return;
    try {
      await assignTicket(selectedId, userId);
      await Promise.all([loadDetail(selectedId), loadEmails()]);
      setBanner("Assignee updated");
    } catch (err) {
      setDetailError(err.message || "Unable to assign ticket");
    }
  }

  async function handleSend() {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    setDetailError("");
    try {
      if (composerTab === "note") {
        await addInternalNote(selectedId, draft.trim());
      } else {
        await replyTicketEmail(selectedId, {
          body: draft.trim(),
          toEmail: customerEmail(selectedTicket) || undefined,
          subject: selectedTicket?.title || undefined,
        });
      }
      setDraft("");
      await loadDetail(selectedId);
      await loadEmails();
      setBanner(composerTab === "note" ? "Internal note added" : "Reply sent");
    } catch (err) {
      setDetailError(err.message || "Unable to send");
    } finally {
      setSending(false);
    }
  }

  function handleForward() {
    const email = customerEmail(selectedTicket);
    const subject = selectedTicket?.title || "";
    if (email) {
      window.open(
        `mailto:?subject=${encodeURIComponent(`Fwd: ${subject}`)}&body=${encodeURIComponent(
          `Forwarding ticket ${selectedTicket?.ticketId || ""}\n\n`
        )}`,
        "_blank"
      );
    } else {
      setBanner("No customer email available to forward");
    }
  }

  const conversation = useMemo(
    () =>
      normalizeThreadMessages(
        messages,
        thread,
        selectedTicket,
        user?.id || user?.userId
      ),
    [messages, thread, selectedTicket, user]
  );

  const noteItems = useMemo(
    () =>
      (notes || []).map((note) => ({
        id: note.id,
        name: note.sender?.name || "Agent",
        email: note.sender?.email || "",
        content: note.content,
        createdAt: note.createdAt,
        isNote: true,
      })),
    [notes]
  );

  const displayMessages =
    composerTab === "note"
      ? [...conversation, ...noteItems].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        )
      : conversation;

  /* ── Thread mode ──────────────────────────────────────────────────────── */

  if (mode === "thread" && selectedTicket) {
    const name = customerName(selectedTicket);
    return (
      <div className="ch-page ch-inbox is-thread">
        <section className="ch-thread">
          <div className="ch-thread__scroll">
            {banner ? (
              <p className="ch-alert ch-alert--success ch-notice-banner">
                {banner}
              </p>
            ) : null}
            {detailError ? (
              <p className="ch-alert ch-alert--error ch-notice-banner">
                {detailError}
              </p>
            ) : null}

            <button
              type="button"
              className="ch-thread__back"
              onClick={backToInbox}
              aria-label="Back to inbox"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="ch-thread__top">
              <div className="ch-thread__id-row">
                <strong className="ch-ticket-id">
                  {formatTicketId(selectedTicket.ticketId)}
                </strong>
                <span className="ch-channel-tag">Email</span>
              </div>
              <div className="ch-thread__actions">
                <button
                  type="button"
                  className="ch-btn ch-btn--ghost"
                  onClick={() => setComposerTab("reply")}
                >
                  <Reply size={15} />
                  Reply
                </button>
                <button
                  type="button"
                  className="ch-btn ch-btn--ghost"
                  onClick={handleForward}
                >
                  <Forward size={15} />
                  Forward
                </button>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="ch-btn ch-btn--ghost"
                    aria-label="More actions"
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {menuOpen ? (
                    <div
                      className="ch-panel"
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "110%",
                        zIndex: 20,
                        minWidth: 180,
                        padding: 8,
                      }}
                    >
                      <button
                        type="button"
                        className="ch-btn ch-btn--ghost"
                        style={{ width: "100%", marginBottom: 6 }}
                        onClick={() => {
                          setMenuOpen(false);
                          backToInbox();
                        }}
                      >
                        Back to list
                      </button>
                      <button
                        type="button"
                        className="ch-btn ch-btn--ghost"
                        style={{ width: "100%" }}
                        onClick={() => {
                          setMenuOpen(false);
                          navigator.clipboard?.writeText(
                            selectedTicket.ticketId || ""
                          );
                          setBanner("Ticket ID copied");
                        }}
                      >
                        Copy ticket ID
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <h1 className="ch-thread__title">{selectedTicket.title}</h1>
            <p className="ch-thread__sub">
              <span>{name}</span>
              <span>
                {formatRelative(
                  selectedTicket.updatedAt || selectedTicket.createdAt
                )}
              </span>
            </p>

            {loadingDetail ? (
              <p className="ch-inbox__empty">Loading conversation…</p>
            ) : displayMessages.length === 0 ? (
              <p className="ch-inbox__empty">No messages yet.</p>
            ) : (
              displayMessages.map((row) => (
                <article
                  key={row.id}
                  className={`ch-msg${row.isNote ? " ch-msg--note" : ""}`}
                >
                  <div className="ch-msg__head">
                    <div
                      className={`ch-avatar ch-avatar--${avatarTone(
                        row.email || row.name
                      )}`}
                    >
                      {initialsFromName(row.name)}
                    </div>
                    <div className="ch-msg__who">
                      <strong>
                        {row.name}
                        {row.isAgent && !row.isNote ? (
                          <span className="ch-badge-agent">Support agent</span>
                        ) : null}
                        {row.isNote ? (
                          <span className="ch-badge-agent">Internal note</span>
                        ) : null}
                      </strong>
                      {row.email ? <span>{row.email}</span> : null}
                    </div>
                    <span className="ch-msg__time">
                      {formatRelative(row.createdAt)}
                    </span>
                  </div>
                  <div className="ch-msg__body">{row.content}</div>
                </article>
              ))
            )}
          </div>

          <Composer
            tab={composerTab}
            onTabChange={setComposerTab}
            draft={draft}
            onDraftChange={setDraft}
            onSend={handleSend}
            sending={sending}
          />
        </section>

        <TicketSidebar
          ticket={selectedTicket}
          agents={agents}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onAssignChange={handleAssignChange}
        />
      </div>
    );
  }

  /* ── Inbox mode ───────────────────────────────────────────────────────── */

  return (
    <div className="ch-page ch-inbox">
      <aside className="ch-inbox__list">
        <div className="ch-inbox__list-head">
          <h1>Email</h1>
          <div className="ch-inbox__search">
            <Search size={16} aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Chat..."
            />
          </div>
          <p className="ch-inbox__count">
            {filtered.length} conversation{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        {listError ? (
          <p className="ch-inbox__empty">{listError}</p>
        ) : loadingList ? (
          <p className="ch-inbox__empty">Loading emails…</p>
        ) : filtered.length === 0 ? (
          <p className="ch-inbox__empty">No email tickets yet.</p>
        ) : (
          <ul className="ch-inbox__threads">
            {filtered.map((ticket) => {
              const id = ticket.ticketId || ticket.id;
              const active = id === selectedId;
              const name = customerName(ticket);
              const unread =
                ticket.status === "OPEN" || ticket.status === "QUEUED";
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`ch-thread-row${active ? " is-active" : ""}`}
                    onClick={() => selectTicket(id)}
                  >
                    <div
                      className={`ch-avatar ch-avatar--${avatarTone(
                        customerEmail(ticket) || name
                      )}`}
                    >
                      {initialsFromName(name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="ch-thread-row__top">
                        <p className="ch-thread-row__name">{name}</p>
                        <span className="ch-thread-row__time">
                          {formatRelative(
                            ticket.updatedAt || ticket.createdAt
                          )}
                        </span>
                      </div>
                      <p className="ch-thread-row__preview">
                        <Mail size={12} aria-hidden="true" color="#1570ef" />
                        <span>{previewText(ticket)}</span>
                      </p>
                    </div>
                    {unread ? (
                      <span className="ch-unread-dot" aria-label="Unread" />
                    ) : (
                      <span />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="ch-detail">
        {banner ? (
          <p className="ch-alert ch-alert--success ch-notice-banner">
            {banner}
          </p>
        ) : null}

        {!selectedTicket ? (
          <div className="ch-detail__empty">
            Select an email conversation to view details
          </div>
        ) : (
          <>
            <div className="ch-detail__meta">
              <span className="ch-detail__id ch-ticket-id">
                {formatTicketId(selectedTicket.ticketId)}
              </span>
              <span
                className={`ch-pill ch-pill--${statusTone(
                  selectedTicket.status
                )}`}
              >
                {statusLabel(selectedTicket.status)}
              </span>
              <span
                className={`ch-pill ch-pill--${priorityTone(
                  selectedTicket.priority
                )}`}
              >
                <span className="ch-pill__dot" aria-hidden="true" />
                {priorityLabel(selectedTicket.priority)}
              </span>
            </div>
            <h2>{selectedTicket.title}</h2>
            <div className="ch-assignee-row">
              {selectedTicket.assignedTo ? (
                <>
                  <div
                    className={`ch-avatar ch-avatar--${avatarTone(
                      selectedTicket.assignedTo.email ||
                        selectedTicket.assignedTo.name
                    )}`}
                  >
                    {initialsFromName(selectedTicket.assignedTo.name)}
                  </div>
                  <div>
                    <strong>{selectedTicket.assignedTo.name}</strong>
                    <span>
                      Assigned to {selectedTicket.assignedTo.name}
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <strong>Unassigned</strong>
                  <span>No agent assigned yet</span>
                </div>
              )}
            </div>

            <div className="ch-info-table">
              <div className="ch-info-table__row">
                <span className="ch-info-table__label">From</span>
                <span className="ch-info-table__value">
                  {customerName(selectedTicket)}
                </span>
              </div>
              <div className="ch-info-table__row">
                <span className="ch-info-table__label">Received</span>
                <span className="ch-info-table__value">
                  {formatDateTime(selectedTicket.createdAt)}
                </span>
              </div>
              <div className="ch-info-table__row">
                <span className="ch-info-table__label">Channel</span>
                <span className="ch-info-table__value">Email</span>
              </div>
              <div className="ch-info-table__row">
                <span className="ch-info-table__label">Assignee</span>
                <span className="ch-info-table__value">
                  {selectedTicket.assignedTo?.name || "—"}
                </span>
              </div>
              <div className="ch-info-table__row">
                <span className="ch-info-table__label">Last activity</span>
                <span className="ch-info-table__value">
                  {formatRelative(
                    selectedTicket.updatedAt || selectedTicket.createdAt
                  ) || "—"}
                </span>
              </div>
            </div>

            {detailError ? (
              <p className="ch-alert ch-alert--error" style={{ marginTop: 16 }}>
                {detailError}
              </p>
            ) : null}

            <div className="ch-detail__actions">
              <button
                type="button"
                className="ch-btn ch-btn--primary"
                onClick={openThread}
              >
                <Reply size={15} />
                Reply
              </button>
              <button
                type="button"
                className="ch-btn ch-btn--ghost"
                onClick={handleForward}
              >
                <Forward size={15} />
                Forward
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Composer({ tab, onTabChange, draft, onDraftChange, onSend, sending }) {
  return (
    <div className="ch-composer">
      <div className="ch-composer__tabs">
        <div className="ch-composer__tab-group">
          <button
            type="button"
            className={`ch-composer__tab${tab === "reply" ? " is-active" : ""}`}
            onClick={() => onTabChange("reply")}
          >
            Reply Message
          </button>
          <button
            type="button"
            className={`ch-composer__tab${tab === "note" ? " is-active" : ""}`}
            onClick={() => onTabChange("note")}
          >
            <Lock size={13} aria-hidden="true" />
            Internal Note
          </button>
        </div>
        <select className="ch-composer__template" defaultValue="" disabled>
          <option value="">Use Message Template</option>
        </select>
      </div>
      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder="Type Reply..."
      />
      <div className="ch-composer__foot">
        <button
          type="button"
          className="ch-btn ch-btn--primary"
          onClick={onSend}
          disabled={sending || !draft.trim()}
        >
          <Send size={15} aria-hidden="true" />
          {sending ? "Sending..." : "Send Reply"}
        </button>
      </div>
    </div>
  );
}

function TicketSidebar({
  ticket,
  agents,
  onStatusChange,
  onPriorityChange,
  onAssignChange,
}) {
  const name = customerName(ticket);
  const email = customerEmail(ticket);

  return (
    <aside className="ch-sidebar">
      <div className="ch-side-card">
        <h3>Ticket Details</h3>
        <div className="ch-side-field">
          <label htmlFor="email-status">Status</label>
          <select
            id="email-status"
            className="ch-select ch-select--premium"
            value={ticket.status || ""}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {statusOptionsFor(ticket.status).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ch-side-field">
          <label htmlFor="email-priority">Priority</label>
          <select
            id="email-priority"
            className="ch-select ch-select--premium"
            value={ticket.priority || "MEDIUM"}
            onChange={(e) => onPriorityChange(e.target.value)}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ch-side-field">
          <label htmlFor="email-assignee">Assigned to</label>
          <select
            id="email-assignee"
            value={ticket.assignedTo?.userId || ""}
            onChange={(e) => onAssignChange(e.target.value)}
          >
            <option value="">Select Agent</option>
            {agents.map((agent) => {
              const id = agent.id || agent.userId;
              const label =
                agent.name ||
                [agent.firstName, agent.lastName].filter(Boolean).join(" ") ||
                agent.email;
              return (
                <option key={id} value={id}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
        <div className="ch-side-field">
          <label>Channel</label>
          <div className="ch-side-static">
            <span className="ch-channel-tag">Email</span>
          </div>
        </div>
        <div className="ch-side-field">
          <label>Created</label>
          <div className="ch-side-static">{formatDateTime(ticket.createdAt)}</div>
        </div>
      </div>

      <div className="ch-side-card">
        <h3>Customer</h3>
        <div className="ch-side-customer">
          <div
            className={`ch-avatar ch-avatar--${avatarTone(email || name)}`}
          >
            {initialsFromName(name)}
          </div>
          <div className="ch-side-customer__name">
            <strong>{name}</strong>
            <span className="ch-side-customer__tag">Customer</span>
          </div>
          {email ? (
            <span className="ch-side-customer__email">{email}</span>
          ) : (
            <span className="ch-side-customer__email">No email on file</span>
          )}
        </div>
      </div>
    </aside>
  );
}
