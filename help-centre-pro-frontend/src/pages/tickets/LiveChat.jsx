import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Paperclip,
  Search,
  Send,
  Smile,
  Ticket,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getMessages,
  listTickets,
  sendMessage,
  updateTicketStatus,
} from "../../api/tickets.api.js";
import TransferTicketModal from "../../components/tickets/TransferTicketModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatTicketId } from "../../utils/format.js";
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
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [banner, setBanner] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  const loadChats = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const result = await listTickets({
        channel: "CHAT",
        page: 1,
        limit: 100,
      });
      const chats = (result?.data?.tickets || [])
        .filter((ticket) => ticketChannel(ticket) === "CHAT")
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt) -
            new Date(a.updatedAt || a.createdAt)
        );
      setTickets(chats);
    } catch (err) {
      setListError(err.message || "Unable to load live chats");
      setTickets([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
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
    if (!q) return tickets;
    return tickets.filter((ticket) => {
      const haystack = [
        ticket.ticketId,
        ticket.title,
        ticket.description,
        ticket.customer?.name,
        ticket.customer?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tickets, searchQuery]);

  const loadThreadMessages = useCallback(async (ticketId, { silent } = {}) => {
    if (!ticketId) return;
    if (!silent) {
      setLoadingMessages(true);
      setMessagesError("");
    }
    try {
      const result = await getMessages(ticketId, { page: 1, limit: 100 });
      const rows = result?.data?.messages || [];
      const sorted = [...rows].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
      setMessages(sorted);
    } catch (err) {
      if (!silent) {
        setMessagesError(err.message || "Unable to load messages");
        setMessages([]);
      }
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedTicket) {
      setMessages([]);
      return undefined;
    }
    const id = selectedTicket.ticketId || selectedTicket.id;
    loadThreadMessages(id);

    pollRef.current = setInterval(() => {
      loadThreadMessages(id, { silent: true });
    }, 6000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedTicket?.ticketId, selectedTicket?.id, loadThreadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function selectThread(ticket) {
    const id = ticket.ticketId || ticket.id;
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
    setSending(true);
    setMessagesError("");
    try {
      const result = await sendMessage(id, content);
      const message = result?.data?.message;
      if (message) {
        setMessages((prev) => {
          if (prev.some((row) => row.id === message.id)) return prev;
          return [...prev, message];
        });
      } else {
        loadThreadMessages(id, { silent: true }).catch(() => {});
      }
      setDraft("");
      setSending(false);
      loadChats().catch(() => {});
    } catch (err) {
      setMessagesError(err.message || "Unable to send message");
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

  return (
    <div className="live-chat">
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
              const active = id === selectedId;
              const unread =
                !isEndedStatus(ticket.status) &&
                (ticket.status === "QUEUED" || ticket.status === "OPEN")
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
                      <p className="live-chat__thread-preview">
                        {previewText(ticket)}
                      </p>
                    </span>
                    <span className="live-chat__thread-meta">
                      <span className="live-chat__thread-time">
                        {formatRelative(ticket.updatedAt || ticket.createdAt)}
                      </span>
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
            {tickets.length
              ? "No chats match your search."
              : "No live chat conversations yet."}
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

            <div className="live-chat__messages">
              {loadingMessages ? (
                <p className="live-chat__empty-list">Loading messages…</p>
              ) : messages.length ? (
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
