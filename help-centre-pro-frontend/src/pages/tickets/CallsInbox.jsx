import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  AudioLines,
  Download,
  Lock,
  Pause,
  Phone,
  PhoneCall,
  Play,
  Search,
  Send,
  Volume2,
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
  fetchTicketRecordingBlob,
  placeOutboundCall,
  sendMessage,
  updateTicketPriority,
  updateTicketStatus,
} from "../../api/tickets.api.js";
import { listUsers } from "../../api/users.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatTicketId, statusLabel } from "../../utils/format.js";
import {
  avatarTone,
  callQualityFromEvent,
  collectTranscript,
  customerEmail,
  customerName,
  customerPhone,
  findCallEvent,
  formatDateTime,
  formatDuration,
  formatRelative,
  initialsFromName,
  previewText,
  PRIORITY_OPTIONS,
  statusOptionsFor,
  statusTone,
  unwrapThread,
} from "./channelUtils.js";
import "../../styles/channels.css";

export default function CallsInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const selectedParam = params.get("ticket") || "";

  const [tickets, setTickets] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(selectedParam);
  const [showThread, setShowThread] = useState(Boolean(selectedParam));
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
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dialTo, setDialTo] = useState("");
  const [placing, setPlacing] = useState(false);
  const [recordingBlobUrl, setRecordingBlobUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const audioRef = useRef(null);

  const loadCalls = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const result = await listTickets({
        channel: "PHONE",
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
      setListError(err.message || "Unable to load call tickets");
      setTickets([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

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
      setShowThread(true);
    }
  }, [selectedParam]);

  const selectedTicket = useMemo(() => {
    if (
      ticketDetail &&
      (ticketDetail.ticketId === selectedId || ticketDetail.id === selectedId)
    ) {
      return ticketDetail;
    }
    return (
      tickets.find((t) => t.ticketId === selectedId || t.id === selectedId) ||
      null
    );
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
        ticket.customer?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tickets, searchQuery]);

  const loadDetail = useCallback(async (ticketId) => {
    if (!ticketId) return;
    setLoadingDetail(true);
    setDetailError("");
    setPlaying(false);
    setProgress(0);
    try {
      const [ticketRes, messagesRes, notesRes, threadRes] = await Promise.all([
        getTicket(ticketId),
        getMessages(ticketId, { page: 1, limit: 100 }).catch(() => null),
        getInternalNotes(ticketId, { page: 1, limit: 100 }).catch(() => null),
        getTicketThread(ticketId).catch(() => null),
      ]);
      setTicketDetail(ticketRes?.data?.ticket || ticketRes?.data || null);
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
  }, []);

  useEffect(() => {
    if (selectedId && showThread) {
      loadDetail(selectedId);
    }
  }, [selectedId, showThread, loadDetail]);

  function openTicket(ticketId) {
    setSelectedId(ticketId);
    setShowThread(true);
    const next = new URLSearchParams(params);
    next.set("ticket", ticketId);
    setParams(next, { replace: true });
  }

  function backToList() {
    setShowThread(false);
    const next = new URLSearchParams(params);
    next.delete("ticket");
    setParams(next, { replace: true });
  }

  async function handleStatusChange(status) {
    if (!selectedId || !status) return;
    if (status === selectedTicket?.status) return;
    setDetailError("");
    try {
      await updateTicketStatus(selectedId, status);
      await Promise.all([loadDetail(selectedId), loadCalls()]);
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
      await Promise.all([loadDetail(selectedId), loadCalls()]);
      setBanner("Priority updated");
    } catch (err) {
      setDetailError(err.message || "Unable to update priority");
    }
  }

  async function handleAssignChange(userId) {
    if (!selectedId || !userId) return;
    try {
      await assignTicket(selectedId, userId);
      await Promise.all([loadDetail(selectedId), loadCalls()]);
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
        await sendMessage(selectedId, draft.trim());
      }
      setDraft("");
      await loadDetail(selectedId);
      await loadCalls();
      setBanner(composerTab === "note" ? "Internal note added" : "Reply sent");
    } catch (err) {
      setDetailError(err.message || "Unable to send");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    const ticket =
      tickets.find((t) => t.ticketId === selectedId || t.id === selectedId) ||
      ticketDetail;
    if (ticket) {
      setDialTo(customerPhone(ticket) || "");
    }
  }, [selectedId, tickets, ticketDetail]);

  async function handlePlaceCall() {
    const to = (dialTo || customerPhone(selectedTicket) || "").trim();
    if (!to || !selectedTicket) {
      setDetailError("Enter a customer phone number to place a call");
      return;
    }
    setDetailError("");
    setBanner("");
    setPlacing(true);
    try {
      const result = await placeOutboundCall({
        to,
        ticketId: selectedTicket.ticketId,
        customerName: customerName(selectedTicket),
        customerEmail: customerEmail(selectedTicket) || undefined,
        title: selectedTicket.title,
        defaultRegion: "NG",
      });
      const data = result?.data || result;
      setBanner(
        data?.message || "Calling customer from your HelpCentre Pro line…"
      );
      await loadDetail(selectedTicket.ticketId);
      await loadCalls();
    } catch (err) {
      setDetailError(err.message || "Unable to place call");
    } finally {
      setPlacing(false);
    }
  }

  const callEvent = useMemo(() => findCallEvent(thread), [thread]);
  const hasRecording = Boolean(
    callEvent?.content?.recordingUrl || callEvent?.metadata?.recordingUrl
  );
  const durationSec = callEvent?.content?.duration ?? null;

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setRecordingBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setPlaying(false);
    setProgress(0);

    async function loadRecording() {
      if (!hasRecording || !selectedTicket?.ticketId) return;
      try {
        const blob = await fetchTicketRecordingBlob(selectedTicket.ticketId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setRecordingBlobUrl(objectUrl);
      } catch {
        if (!cancelled) setRecordingBlobUrl("");
      }
    }
    loadRecording();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasRecording, selectedTicket?.ticketId]);

  const callStatus = String(
    callEvent?.content?.callStatus ||
      callEvent?.metadata?.callStatus ||
      (hasRecording ? "completed" : callEvent ? "logged" : "")
  ).toLowerCase();
  const quality = callQualityFromEvent(callEvent);
  const transcript = useMemo(() => collectTranscript(thread), [thread]);

  const conversation = useMemo(() => {
    const rows = (messages || []).map((message) => {
      const custEmail = String(selectedTicket?.customer?.email || "").toLowerCase();
      const senderEmail = String(message?.sender?.email || "").toLowerCase();
      const isCustomer =
        custEmail && senderEmail && custEmail === senderEmail;
      const isAgent =
        !isCustomer &&
        (message?.sender?.userId === (user?.id || user?.userId) ||
          Boolean(message?.sender?.userId));
      return {
        id: message.id,
        name: message.sender?.name || "Unknown",
        email: message.sender?.email || "",
        content: message.content,
        createdAt: message.createdAt,
        isAgent,
        isNote: false,
      };
    });
    const noteRows = (notes || []).map((note) => ({
      id: note.id,
      name: note.sender?.name || "Agent",
      email: note.sender?.email || "",
      content: note.content,
      createdAt: note.createdAt,
      isAgent: true,
      isNote: true,
    }));
    return [...rows, ...noteRows].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
  }, [messages, notes, selectedTicket, user]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !recordingBlobUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    audio.play().then(() => setPlaying(true)).catch(() => {
      setDetailError("Unable to play recording");
      setPlaying(false);
    });
  }

  async function handleDownloadRecording() {
    if (!selectedTicket?.ticketId || downloading) return;
    setDownloading(true);
    setDetailError("");
    try {
      const blob =
        recordingBlobUrl
          ? await fetch(recordingBlobUrl).then((r) => r.blob())
          : await fetchTicketRecordingBlob(selectedTicket.ticketId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${formatTicketId(selectedTicket.ticketId)}-recording.mp3`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setBanner("Recording downloaded");
    } catch (err) {
      setDetailError(err.message || "Unable to download recording");
    } finally {
      setDownloading(false);
    }
  }

  function copyTranscript() {
    if (!transcript.length) {
      setBanner("No transcript to copy");
      return;
    }
    const text = transcript
      .map((line) => `${line.speaker}: ${line.text}`)
      .join("\n");
    navigator.clipboard?.writeText(text);
    setBanner("Transcript copied");
  }

  /* ── List mode ────────────────────────────────────────────────────────── */

  if (!showThread) {
    return (
      <div className="ch-page ch-inbox">
        <aside className="ch-inbox__list">
          <div className="ch-inbox__list-head">
            <h1>Calls</h1>
            <div className="ch-inbox__search">
              <Search size={16} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search calls..."
              />
            </div>
            <p className="ch-inbox__count">
              {filtered.length} conversation{filtered.length === 1 ? "" : "s"}
            </p>
          </div>

          {listError ? (
            <p className="ch-inbox__empty">{listError}</p>
          ) : loadingList ? (
            <p className="ch-inbox__empty">Loading calls…</p>
          ) : filtered.length === 0 ? (
            <p className="ch-inbox__empty">No call tickets yet.</p>
          ) : (
            <ul className="ch-inbox__threads">
              {filtered.map((ticket) => {
                const id = ticket.ticketId || ticket.id;
                const name = customerName(ticket);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="ch-thread-row"
                      onClick={() => openTicket(id)}
                    >
                      <div
                        className={`ch-avatar ch-avatar--${avatarTone(
                          customerPhone(ticket) || name
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
                          <Phone size={12} aria-hidden="true" color="#6941c6" />
                          <span>{previewText(ticket)}</span>
                        </p>
                      </div>
                      <span />
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
          <div className="ch-detail__empty">
            Select a call to view recording, transcript, and details
          </div>
        </section>
      </div>
    );
  }

  /* ── Thread / detail mode ─────────────────────────────────────────────── */

  if (!selectedTicket) {
    return (
      <div className="ch-page ch-inbox is-thread">
        <section className="ch-thread">
          <div className="ch-thread__scroll">
            <button
              type="button"
              className="ch-thread__back"
              onClick={backToList}
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <p className="ch-inbox__empty">
              {loadingDetail ? "Loading…" : "Call ticket not found."}
            </p>
          </div>
        </section>
      </div>
    );
  }

  const name = customerName(selectedTicket);
  const phone = customerPhone(selectedTicket);
  const email = customerEmail(selectedTicket);

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
            onClick={backToList}
            aria-label="Back to calls"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="ch-thread__id-row">
            <strong className="ch-ticket-id">
              {formatTicketId(selectedTicket.ticketId)}
            </strong>
            <span className="ch-channel-tag">call</span>
            <span
              className={`ch-pill ch-pill--${statusTone(selectedTicket.status)}`}
            >
              {statusLabel(selectedTicket.status)}
            </span>
          </div>

          <h1 className="ch-thread__title">{selectedTicket.title}</h1>
          <p className="ch-thread__sub">
            {phone ? (
              <span className="ch-thread__sub-item">
                <Phone size={14} aria-hidden="true" />
                {phone}
              </span>
            ) : null}
            <span className="ch-thread__sub-item">{name}</span>
            <span className="ch-thread__sub-item">
              {formatRelative(
                selectedTicket.updatedAt || selectedTicket.createdAt
              )}
            </span>
          </p>

          <div className="ch-call-card">
            <div className="ch-call-card__head">
              <Phone className="ch-call-icon" size={18} aria-hidden="true" />
              {callStatus === "completed" || hasRecording ? (
                <span className="ch-pill ch-pill--resolved">completed</span>
              ) : callEvent ? (
                <span className="ch-pill ch-pill--open">
                  {callStatus || "in progress"}
                </span>
              ) : (
                <span className="ch-pill ch-pill--closed">No call data</span>
              )}
              <span className="ch-call-card__duration">
                {durationSec != null ? formatDuration(durationSec) : "0:00"}
              </span>
            </div>

            <div className="ch-dial-row">
              <div className="ch-field" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="dial-customer">Customer number</label>
                <input
                  id="dial-customer"
                  className="ch-input"
                  value={dialTo}
                  onChange={(e) => setDialTo(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <button
                type="button"
                className="ch-btn ch-btn--call"
                onClick={handlePlaceCall}
                disabled={placing || !dialTo.trim()}
              >
                <PhoneCall size={15} aria-hidden="true" />
                {placing ? "Calling…" : "Place call"}
              </button>
            </div>

            <div className="ch-audio">
              <button
                type="button"
                className="ch-audio__play"
                onClick={togglePlay}
                disabled={!recordingBlobUrl}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <div
                className={`ch-audio__bar${recordingBlobUrl ? " is-live" : ""}`}
                style={{ "--progress": `${progress}%` }}
              >
                <span />
              </div>
              <span className="ch-audio__meta">
                {recordingBlobUrl
                  ? playing
                    ? "Playing"
                    : "Ready"
                  : hasRecording
                    ? "Loading recording…"
                    : "No recording available"}
              </span>
              <Volume2 size={16} color="#98a2b3" aria-hidden="true" />
              <button
                type="button"
                className="ch-audio__dl"
                onClick={handleDownloadRecording}
                disabled={!hasRecording || downloading}
                aria-label="Download recording"
              >
                <Download size={16} />
              </button>
            </div>

            {recordingBlobUrl ? (
              <audio
                ref={audioRef}
                src={recordingBlobUrl}
                preload="metadata"
                onTimeUpdate={(e) => {
                  const el = e.currentTarget;
                  if (!el.duration) return;
                  setProgress((el.currentTime / el.duration) * 100);
                }}
                onEnded={() => {
                  setPlaying(false);
                  setProgress(0);
                }}
              />
            ) : null}

            {quality ? (
              <div className="ch-quality">
                {[
                  {
                    key: "network",
                    label: "Network",
                    Icon: Signal,
                    value: quality.network || quality.Network,
                  },
                  {
                    key: "audio",
                    label: "Audio clarity",
                    Icon: AudioLines,
                    value:
                      quality.audioClarity ||
                      quality.audio ||
                      quality["Audio clarity"],
                  },
                  {
                    key: "stability",
                    label: "Stability",
                    Icon: Activity,
                    value: quality.stability || quality.Stability,
                  },
                ]
                  .filter((item) => item.value)
                  .map((item) => (
                    <div key={item.key} className="ch-quality__item">
                      <span>
                        <item.Icon size={14} aria-hidden="true" />
                        {item.label}
                      </span>
                      <span className="ch-pill ch-pill--resolved">
                        {String(item.value)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>

          <div className="ch-call-card">
            <div className="ch-transcript__head">
              <h3>Transcript</h3>
              <button
                type="button"
                className="ch-btn ch-btn--ghost"
                onClick={copyTranscript}
                disabled={!transcript.length}
              >
                Copy Transcript
              </button>
            </div>
            {transcript.length === 0 ? (
              <p className="ch-inbox__empty" style={{ padding: "12px 0" }}>
                No transcript available for this call.
              </p>
            ) : (
              transcript.map((line, index) => (
                <div
                  key={`${line.speaker}-${index}`}
                  className="ch-transcript__line"
                >
                  <div
                    className={`ch-avatar ch-avatar--sm ch-avatar--${avatarTone(
                      line.speaker
                    )}`}
                  >
                    {line.initials}
                  </div>
                  <div>
                    <strong>
                      {line.speaker}
                      {line.role ? ` · ${line.role}` : ""}
                    </strong>
                    <p>{line.text}</p>
                  </div>
                  {line.time ? (
                    <span className="ch-transcript__time">{line.time}</span>
                  ) : (
                    <span />
                  )}
                </div>
              ))
            )}
          </div>

          {conversation.length ? (
            <div style={{ marginTop: 8 }}>
              {conversation.map((row) => (
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
                        {row.isNote ? (
                          <span className="ch-badge-agent">Internal note</span>
                        ) : row.isAgent ? (
                          <span className="ch-badge-agent">Support agent</span>
                        ) : null}
                      </strong>
                    </div>
                    <span className="ch-msg__time">
                      {formatRelative(row.createdAt)}
                    </span>
                  </div>
                  <div className="ch-msg__body">{row.content}</div>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <div className="ch-composer">
          <div className="ch-composer__tabs">
            <div className="ch-composer__tab-group">
              <button
                type="button"
                className={`ch-composer__tab${
                  composerTab === "reply" ? " is-active" : ""
                }`}
                onClick={() => setComposerTab("reply")}
              >
                Reply Message
              </button>
              <button
                type="button"
                className={`ch-composer__tab${
                  composerTab === "note" ? " is-active" : ""
                }`}
                onClick={() => setComposerTab("note")}
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
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type Reply..."
          />
          <div className="ch-composer__foot">
            <button
              type="button"
              className="ch-btn ch-btn--primary"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
            >
              <Send size={15} aria-hidden="true" />
              {sending ? "Sending..." : "Send Reply"}
            </button>
          </div>
        </div>
      </section>

      <aside className="ch-sidebar">
        <div className="ch-side-card">
          <h3>Ticket Details</h3>
          <div className="ch-side-field">
            <label htmlFor="call-status">Status</label>
            <select
              id="call-status"
              className="ch-select ch-select--premium"
              value={selectedTicket.status || ""}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {statusOptionsFor(selectedTicket.status).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ch-side-field">
            <label htmlFor="call-priority">Priority</label>
            <select
              id="call-priority"
              className="ch-select ch-select--premium"
              value={selectedTicket.priority || "MEDIUM"}
              onChange={(e) => handlePriorityChange(e.target.value)}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ch-side-field">
            <label htmlFor="call-assignee">Assigned to</label>
            <select
              id="call-assignee"
              value={selectedTicket.assignedTo?.userId || ""}
              onChange={(e) => handleAssignChange(e.target.value)}
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
              <span className="ch-channel-tag">Call</span>
            </div>
          </div>
          <div className="ch-side-field">
            <label>Created</label>
            <div className="ch-side-static">
              {formatDateTime(selectedTicket.createdAt)}
            </div>
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
            ) : phone ? (
              <span className="ch-side-customer__email">{phone}</span>
            ) : (
              <span className="ch-side-customer__email">No contact on file</span>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
