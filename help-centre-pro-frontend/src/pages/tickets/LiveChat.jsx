import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Check,
  Copy,
  Mail,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getMessages,
  listTickets,
  sendMessage,
  updateTicketStatus,
} from "../../api/tickets.api.js";
import TransferTicketModal from "../../components/tickets/TransferTicketModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatTicketId } from "../../utils/format.js";
import {
  customerEmail,
  customerPhone,
  isFreshTicket,
  sortTicketsNewestFirst,
  ticketActivityAt,
} from "./channelUtils.js";
import "../../styles/tickets.css";

const AVATAR_TONES = ["blue", "violet", "orange", "green", "rose", "teal"];

function ticketChannel(ticket) {
  return String(ticket?.channel || ticket?.sourceChannel || "MANUAL").toUpperCase();
}

function initialsFromName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

function avatarTone(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  }
  return AVATAR_TONES[hash];
}

function formatRelative(value) {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatMessageTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function customerName(ticket) {
  return (
    ticket?.customer?.name ||
    ticket?.customer?.email ||
    ticket?.title ||
    "Customer"
  );
}

function previewText(ticket) {
  const text = ticket?.description || ticket?.title || "No messages yet";
  return text.length > 64 ? `${text.slice(0, 64)}…` : text;
}

function isEndedStatus(status) {
  return status === "CLOSED" || status === "RESOLVED";
}

function endStatusFor(ticket) {
  // QUEUED can only go OPEN or CLOSED; other open states prefer RESOLVED.
  if (ticket?.status === "QUEUED") return "CLOSED";
  if (ticket?.status === "RESOLVED") return "CLOSED";
  if (ticket?.status === "CLOSED") return null;
  return "RESOLVED";
}

function isAgentMessage(message, currentUserId, ticket) {
  const senderId = message?.sender?.userId;
  if (!senderId) return false;
  const customerEmail = String(ticket?.customer?.email || "").toLowerCase();
  const senderEmail = String(message?.sender?.email || "").toLowerCase();
  if (customerEmail && senderEmail && customerEmail === senderEmail) {
    return false;
  }
  if (currentUserId && senderId === currentUserId) return true;
  if (ticket?.assignedTo?.userId && senderId === ticket.assignedTo.userId) {
    return true;
  }
  return true;
}

export default function LiveChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedParam = params.get("ticket") || "";

  const [tickets, setTickets] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedId, setSelectedId] = useState(selectedParam);
  const [messages, setMessages] = useState([]);
  /** Ticket id the `messages` array belongs to — avoids flashing the wrong thread. */
  const [messagesForId, setMessagesForId] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [banner, setBanner] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [copiedField, setCopiedField] = useState("");

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const pendingJumpRef = useRef(false);
  const scrollSignatureRef = useRef("");
  const pollRef = useRef(null);
  const copyTimerRef = useRef(null);

  const loadChats = useCallback(async ({ silent } = {}) => {
    if (!silent) {
      setLoadingList(true);
      setListError("");
    }
    try {
      const result = await listTickets({
        channel: "CHAT",
        page: 1,
        limit: 100,
      });
      let rows = result?.data?.tickets || [];
      // Fallback: if channel filter returns empty (legacy rows), scan recent inbox.
      if (!rows.length) {
        const broad = await listTickets({ page: 1, limit: 100 });
        rows = (broad?.data?.tickets || []).filter(
          (ticket) => ticketChannel(ticket) === "CHAT"
        );
      } else {
        rows = rows.filter((ticket) => ticketChannel(ticket) === "CHAT");
      }
      // Live inbox = active threads only. Ended chats live under All Tickets.
      const active = rows.filter((ticket) => !isEndedStatus(ticket.status));
      setTickets(sortTicketsNewestFirst(active.length ? active : rows));
    } catch (err) {
      if (!silent) {
        setListError(err.message || "Unable to load live chats");
        // Keep existing threads on a failed refresh so reload flicker never
        // looks like "chats were deleted".
      }
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
    const listPoll = setInterval(() => {
      loadChats({ silent: true });
    }, 8000);
    return () => clearInterval(listPoll);
  }, [loadChats]);

  useEffect(() => {
    if (selectedParam) {
      setSelectedId(selectedParam);
      return;
    }
    if (!selectedId && tickets.length) {
      const first = tickets[0].ticketId || tickets[0].id;
      setSelectedId(first);
      const next = new URLSearchParams(params);
      next.set("ticket", first);
      setParams(next, { replace: true });
    }
  }, [selectedParam, tickets, selectedId, params, setParams]);

  const selectedTicket = useMemo(
    () =>
      tickets.find((t) => t.ticketId === selectedId || t.id === selectedId) ||
      null,
    [tickets, selectedId]
  );

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = !q
      ? tickets
      : tickets.filter((ticket) => {
          const haystack = [
            ticket.ticketId,
            ticket.title,
            ticket.description,
            ticket.customer?.name,
            ticket.customer?.email,
            ticket.customer?.phone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        });
    return sortTicketsNewestFirst(list);
  }, [tickets, searchQuery]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  async function copyContact(value, field) {
    const text = String(value || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setBanner(
        field === "email"
          ? `Copied ${text} — ready to email.`
          : `Copied ${text} — ready to call.`
      );
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedField(""), 1800);
    } catch {
      setMessagesError("Could not copy to clipboard");
    }
  }

  const scrollThreadToLatest = useCallback((behavior = "auto") => {
    const pane = messagesContainerRef.current;
    if (pane) {
      pane.scrollTo({ top: pane.scrollHeight, behavior });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const loadThreadMessages = useCallback(
    async (ticket, { silent } = {}) => {
      const ticketId = ticket?.ticketId || ticket?.id || ticket;
      if (!ticketId || typeof ticketId !== "string") return;
      if (!silent) {
        setLoadingMessages(true);
        setMessagesError("");
      }
      try {
        // latest=true → newest window; we still render oldest → newest.
        const result = await getMessages(ticketId, {
          page: 1,
          limit: 100,
          latest: true,
        });
        let rows = result?.data?.messages || result?.messages || [];
        // If the API has not yet hydrated timeline events, seed from ticket
        // description so the pane never looks empty while the list has a preview.
        if (!rows.length) {
          const seed =
            (typeof ticket === "object" && ticket?.description) ||
            selectedTicket?.description ||
            "";
          if (String(seed).trim()) {
            rows = [
              {
                id: `desc:${ticketId}`,
                content: String(seed).trim(),
                createdAt:
                  (typeof ticket === "object" && ticket?.createdAt) ||
                  selectedTicket?.createdAt ||
                  new Date().toISOString(),
                sender: {
                  userId: null,
                  name:
                    (typeof ticket === "object" &&
                      (ticket?.customer?.name || ticket?.customerName)) ||
                    selectedTicket?.customer?.name ||
                    "Customer",
                  email:
                    (typeof ticket === "object" &&
                      (ticket?.customer?.email || ticket?.customerEmail)) ||
                    selectedTicket?.customer?.email ||
                    "",
                },
              },
            ];
          }
        }
        const sorted = [...rows].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        setMessages(sorted);
        setMessagesForId(ticketId);
      } catch (err) {
        if (!silent) {
          setMessagesError(err.message || "Unable to load messages");
        }
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [selectedTicket]
  );

  useEffect(() => {
    if (!selectedTicket) {
      setMessages([]);
      setMessagesForId("");
      return undefined;
    }
    const id = selectedTicket.ticketId || selectedTicket.id;
    stickToBottomRef.current = true;
    pendingJumpRef.current = true;
    // Seed from description immediately so the pane never looks empty while
    // the list already shows a preview — then hydrate from the API.
    const seed = String(selectedTicket.description || "").trim();
    setMessagesForId((prev) => {
      if (prev === id) return prev;
      if (seed) {
        setMessages([
          {
            id: `desc:${id}`,
            content: seed,
            createdAt: selectedTicket.createdAt || new Date().toISOString(),
            sender: {
              userId: null,
              name: selectedTicket.customer?.name || "Customer",
              email: selectedTicket.customer?.email || "",
            },
          },
        ]);
        return id;
      }
      setMessages([]);
      return "";
    });
    loadThreadMessages(selectedTicket);

    pollRef.current = setInterval(() => {
      loadThreadMessages(selectedTicket, { silent: true });
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedTicket?.ticketId, selectedTicket?.id, loadThreadMessages]);

  useEffect(() => {
    if (loadingMessages) return undefined;
    if (!stickToBottomRef.current && !pendingJumpRef.current) return undefined;

    const signature = messages.map((row) => row.id).join("|");
    const jump = pendingJumpRef.current;
    if (!jump && signature === scrollSignatureRef.current) return undefined;
    scrollSignatureRef.current = signature;
    pendingJumpRef.current = false;

    const frame = requestAnimationFrame(() => {
      scrollThreadToLatest(jump ? "auto" : "smooth");
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, loadingMessages, scrollThreadToLatest]);

  function handleMessagesScroll() {
    const pane = messagesContainerRef.current;
    if (!pane) return;
    const distance = pane.scrollHeight - pane.scrollTop - pane.clientHeight;
    stickToBottomRef.current = distance < 96;
  }

  function selectThread(ticket) {
    const id = ticket.ticketId || ticket.id;
    stickToBottomRef.current = true;
    pendingJumpRef.current = true;
    setSelectedId(id);
    setDraft("");
    setMessagesError("");
    setBanner("");
    const next = new URLSearchParams(params);
    next.set("ticket", id);
    setParams(next, { replace: true });
  }

  function patchTicketStatus(ticketId, status) {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.ticketId === ticketId || ticket.id === ticketId
          ? { ...ticket, status, updatedAt: new Date().toISOString() }
          : ticket
      )
    );
  }

  async function handleSend(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedTicket || sending) return;
    if (isEndedStatus(selectedTicket.status)) {
      setMessagesError("This chat has ended. Reopen the ticket to continue.");
      return;
    }
    const id = selectedTicket.ticketId || selectedTicket.id;
    const optimisticId = `local-${Date.now()}`;
    const optimistic = {
      id: optimisticId,
      content,
      createdAt: new Date().toISOString(),
      sender: {
        userId: user?.id || user?.userId,
        name: user?.name || user?.email || "You",
        email: user?.email,
      },
    };
    setDraft("");
    setSending(true);
    setMessagesError("");
    stickToBottomRef.current = true;
    pendingJumpRef.current = true;
    setMessagesForId(id);
    setMessages((prev) => [...prev, optimistic]);
    setTickets((prev) =>
      sortTicketsNewestFirst(
        prev.map((ticket) =>
          ticket.ticketId === id || ticket.id === id
            ? {
                ...ticket,
                description: content,
                updatedAt: new Date().toISOString(),
                lastAgentResponseAt: new Date().toISOString(),
              }
            : ticket
        )
      )
    );
    try {
      const result = await sendMessage(id, content);
      const message = result?.data?.message;
      if (message) {
        setMessages((prev) => {
          const withoutOptimistic = prev.filter((row) => row.id !== optimisticId);
          if (withoutOptimistic.some((row) => row.id === message.id)) {
            return withoutOptimistic;
          }
          return [...withoutOptimistic, message];
        });
      } else {
        loadThreadMessages(selectedTicket, { silent: true }).catch(() => {});
      }
    } catch (err) {
      setMessages((prev) => prev.filter((row) => row.id !== optimisticId));
      setDraft(content);
      setMessagesError(err.message || "Unable to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleEndChat() {
    if (!selectedTicket || ending) return;
    if (isEndedStatus(selectedTicket.status)) return;

    const id = selectedTicket.ticketId || selectedTicket.id;
    const preferred = endStatusFor(selectedTicket);
    if (!preferred) return;

    setEnding(true);
    setMessagesError("");
    setBanner("");
    try {
      await updateTicketStatus(id, preferred);
      patchTicketStatus(id, preferred);
      setBanner(
        preferred === "CLOSED"
          ? "Chat ended and ticket closed."
          : "Chat ended. Ticket marked resolved."
      );
      setDraft("");
      await loadChats();
    } catch (err) {
      try {
        await updateTicketStatus(id, "CLOSED");
        patchTicketStatus(id, "CLOSED");
        setBanner("Chat ended and ticket closed.");
        setDraft("");
        await loadChats();
      } catch (inner) {
        setMessagesError(inner.message || err.message || "Unable to end chat");
      }
    } finally {
      setEnding(false);
    }
  }

  const ended = selectedTicket ? isEndedStatus(selectedTicket.status) : false;
  const name = selectedTicket ? customerName(selectedTicket) : "";
  const email = selectedTicket ? customerEmail(selectedTicket) : "";
  const phone = selectedTicket ? customerPhone(selectedTicket) : "";

  return (
    <div className={`live-chat${selectedTicket ? " has-visitor" : ""}`}>
      <aside className="live-chat__list">
        <div className="live-chat__list-head">
          <h1>Live Chat</h1>
          <div className="live-chat__search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Chat..."
              aria-label="Search chat"
            />
          </div>
        </div>

        {listError ? (
          <p className="live-chat__empty-list">{listError}</p>
        ) : loadingList ? (
          <p className="live-chat__empty-list">Loading conversations…</p>
        ) : filteredThreads.length ? (
          <ul className="live-chat__threads">
            {filteredThreads.map((ticket) => {
              const id = ticket.ticketId || ticket.id;
              const threadName = customerName(ticket);
              const threadEmail = customerEmail(ticket);
              const threadPhone = customerPhone(ticket);
              const active = id === selectedId;
              const waitingOnAgent =
                !isEndedStatus(ticket.status) &&
                Boolean(ticket.lastCustomerResponseAt) &&
                (!ticket.lastAgentResponseAt ||
                  new Date(ticket.lastCustomerResponseAt) >
                    new Date(ticket.lastAgentResponseAt));
              const unread =
                !active &&
                (ticket.status === "QUEUED" || waitingOnAgent)
                  ? 1
                  : 0;

              return (
                <li key={ticket.id || id}>
                  <button
                    type="button"
                    className={`live-chat__thread${active ? " is-active" : ""}`}
                    onClick={() => selectThread(ticket)}
                  >
                    <span
                      className={`tk-avatar tone-${avatarTone(threadName)}`}
                      aria-hidden="true"
                    >
                      {initialsFromName(threadName)}
                    </span>
                    <span>
                      <p className="live-chat__thread-name">{threadName}</p>
                      <p className="live-chat__thread-contact">
                        {formatTicketId(id)}
                        {threadEmail || threadPhone
                          ? ` · ${threadEmail || threadPhone}`
                          : ""}
                      </p>
                      <p className="live-chat__thread-preview">
                        {previewText(ticket)}
                      </p>
                    </span>
                    <span className="live-chat__thread-meta">
                      <span className="live-chat__thread-time">
                        {formatRelative(
                          ticketActivityAt(ticket) ||
                            ticket.updatedAt ||
                            ticket.createdAt
                        )}
                      </span>
                      {isFreshTicket(ticket) && !active ? (
                        <span className="ch-fresh-pill">New</span>
                      ) : null}
                      {unread ? (
                        <span className="live-chat__unread">{unread}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="live-chat__empty-list">
            {tickets.length ? (
              "No chats match your search."
            ) : (
              <>
                No live chat conversations yet. New visitor chats stay here
                after reload — open one from your widget or{" "}
                <Link to="/docs/integration">integration docs</Link>.
              </>
            )}
          </p>
        )}
      </aside>

      <section className="live-chat__pane">
        {!selectedTicket ? (
          <div className="live-chat__pane-empty">
            Select a conversation to start chatting
          </div>
        ) : (
          <>
            <header className="live-chat__pane-head">
              <div className="live-chat__pane-person">
                <span
                  className={`tk-avatar tk-avatar--lg tone-${avatarTone(name)}`}
                  aria-hidden="true"
                >
                  {initialsFromName(name)}
                </span>
                <div>
                  <h2>{name}</h2>
                  <p className="live-chat__presence">
                    <span
                      className={`live-chat__presence-dot${
                        ended ? " is-ended" : ""
                      }`}
                      aria-hidden="true"
                    />
                    {ended ? "Ended" : "Active"}
                  </p>
                  {(email || phone) ? (
                    <div className="live-chat__contact-inline">
                      {email ? (
                        <a
                          className="live-chat__contact-chip"
                          href={`mailto:${email}`}
                          title={`Email ${email}`}
                        >
                          <Mail size={12} aria-hidden="true" />
                          <span>{email}</span>
                        </a>
                      ) : null}
                      {phone ? (
                        <a
                          className="live-chat__contact-chip"
                          href={`tel:${phone.replace(/\s+/g, "")}`}
                          title={`Call ${phone}`}
                        >
                          <Phone size={12} aria-hidden="true" />
                          <span>{phone}</span>
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="live-chat__pane-actions">
                <span
                  className={`live-chat__pill${ended ? " is-ended" : ""}`}
                >
                  {ended ? "Ended" : "Active"}
                </span>
                <button
                  type="button"
                  className="live-chat__btn live-chat__btn--ghost"
                  title="View in All Tickets"
                  onClick={() => navigate("/tickets")}
                >
                  <Ticket size={14} aria-hidden="true" />
                  {formatTicketId(selectedTicket.ticketId)}
                </button>
                <button
                  type="button"
                  className="live-chat__btn live-chat__btn--primary"
                  onClick={() => setTransferOpen(true)}
                >
                  <ArrowRightLeft size={14} aria-hidden="true" />
                  Transfer
                </button>
                <button
                  type="button"
                  className="live-chat__btn live-chat__btn--danger"
                  onClick={handleEndChat}
                  disabled={ended || ending}
                >
                  <X size={14} aria-hidden="true" />
                  {ending ? "Ending…" : "End chat"}
                </button>
              </div>
            </header>

            {banner ? (
              <p className="live-chat__banner live-chat__banner--ok">{banner}</p>
            ) : null}
            {messagesError ? (
              <p className="live-chat__error">{messagesError}</p>
            ) : null}

            <div
              className="live-chat__messages"
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
            >
              <div className="live-chat__messages-spacer" aria-hidden="true" />
              {messagesForId ===
                (selectedTicket.ticketId || selectedTicket.id) &&
              messages.length ? (
                messages.map((message) => {
                  const agent = isAgentMessage(
                    message,
                    user?.id || user?.userId,
                    selectedTicket
                  );
                  return (
                    <div
                      key={message.id}
                      className={`live-chat__bubble-row ${
                        agent ? "is-agent" : "is-customer"
                      }`}
                    >
                      <div className="live-chat__bubble">{message.content}</div>
                      <span className="live-chat__bubble-time">
                        {formatMessageTime(message.createdAt)}
                      </span>
                    </div>
                  );
                })
              ) : loadingMessages ? (
                <p className="live-chat__empty-list">Loading messages…</p>
              ) : (
                <p className="live-chat__empty-list">
                  No messages yet. Say hello to start the conversation.
                </p>
              )}
              {ended ? (
                <div className="live-chat__ended-note">
                  This conversation has ended.
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            <form className="live-chat__composer" onSubmit={handleSend}>
              <div className="live-chat__composer-field">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    ended ? "Chat ended" : "Type a message..."
                  }
                  aria-label="Type a message"
                  disabled={ended || sending}
                />
                <button
                  type="button"
                  className="live-chat__composer-icon"
                  aria-label="Attach file"
                  disabled={ended}
                >
                  <Paperclip size={16} />
                </button>
                <button
                  type="button"
                  className="live-chat__composer-icon"
                  aria-label="Insert emoji"
                  disabled={ended}
                >
                  <Smile size={16} />
                </button>
              </div>
              <button
                type="submit"
                className="live-chat__send"
                aria-label="Send message"
                disabled={ended || sending || !draft.trim()}
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </section>

      {selectedTicket ? (
        <aside className="live-chat__visitor" aria-label="Visitor details">
          <div className="live-chat__visitor-head">
            <UserRound size={16} aria-hidden="true" />
            <h3>Visitor</h3>
          </div>

          <div className="live-chat__visitor-card">
            <span
              className={`tk-avatar tk-avatar--lg tone-${avatarTone(name)}`}
              aria-hidden="true"
            >
              {initialsFromName(name)}
            </span>
            <div>
              <strong>{name}</strong>
              <span className="live-chat__visitor-status">
                {ended ? "Chat ended" : "In conversation"}
              </span>
            </div>
          </div>

          <div className="live-chat__visitor-section">
            <p className="live-chat__visitor-label">Contact</p>

            <div className="live-chat__visitor-row">
              <div className="live-chat__visitor-icon" aria-hidden="true">
                <Mail size={15} />
              </div>
              <div className="live-chat__visitor-meta">
                <span>Email</span>
                {email ? (
                  <a href={`mailto:${email}`}>{email}</a>
                ) : (
                  <em>Not provided</em>
                )}
              </div>
              {email ? (
                <button
                  type="button"
                  className="live-chat__visitor-copy"
                  onClick={() => copyContact(email, "email")}
                  aria-label="Copy email"
                  title="Copy email"
                >
                  {copiedField === "email" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              ) : null}
            </div>

            <div className="live-chat__visitor-row">
              <div className="live-chat__visitor-icon" aria-hidden="true">
                <Phone size={15} />
              </div>
              <div className="live-chat__visitor-meta">
                <span>Phone</span>
                {phone ? (
                  <a href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</a>
                ) : (
                  <em>Not provided</em>
                )}
              </div>
              {phone ? (
                <button
                  type="button"
                  className="live-chat__visitor-copy"
                  onClick={() => copyContact(phone, "phone")}
                  aria-label="Copy phone"
                  title="Copy phone"
                >
                  {copiedField === "phone" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              ) : null}
            </div>
          </div>

          <div className="live-chat__visitor-actions">
            <button
              type="button"
              className="live-chat__btn live-chat__btn--primary"
              disabled={!email}
              title={email ? `Compose email to ${email}` : "No email on file"}
              onClick={() => {
                if (!email) return;
                navigate(
                  `/tickets/new/email?to=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`
                );
              }}
            >
              <Mail size={14} aria-hidden="true" />
              Email visitor
            </button>
            <button
              type="button"
              className="live-chat__btn live-chat__btn--ghost"
              disabled={!phone}
              title={phone ? `Open Calls with ${phone}` : "No phone on file"}
              onClick={() => {
                if (!phone) return;
                navigate(
                  `/tickets/calls?dial=${encodeURIComponent(phone)}&ticket=${encodeURIComponent(
                    selectedTicket.ticketId || selectedTicket.id
                  )}`
                );
              }}
            >
              <Phone size={14} aria-hidden="true" />
              Call visitor
            </button>
          </div>

          <p className="live-chat__visitor-hint">
            Captured when the visitor starts chat via your widget. Use these to
            follow up by email or phone without leaving the conversation.
          </p>
        </aside>
      ) : null}

      {transferOpen && selectedTicket ? (
        <TransferTicketModal
          ticket={selectedTicket}
          onClose={() => setTransferOpen(false)}
          onTransferred={async () => {
            setTransferOpen(false);
            setBanner("Ticket transferred");
            await loadChats();
          }}
        />
      ) : null}
    </div>
  );
}
