import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  MessageSquare,
  MoreVertical,
  Phone,
  Search,
  UserSearch,
  UserX,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listTickets, updateTicketStatus } from "../../api/tickets.api.js";
import { listUsers } from "../../api/users.api.js";
import ConfirmActionModal from "../../components/agents/ConfirmActionModal.jsx";
import TransferTicketModal from "../../components/tickets/TransferTicketModal.jsx";
import { formatTicketId, priorityLabel, statusLabel } from "../../utils/format.js";
import { channelTicketPath } from "./channelUtils.js";
import "../../styles/tickets.css";
import "../../styles/admin.css";

const CHANNEL_ROUTE = {
  "/tickets/emails": "EMAIL",
  "/tickets/calls": "PHONE",
};

const CHANNEL_META = {
  EMAIL: { label: "Email", Icon: Mail },
  CHAT: { label: "Live chat", Icon: MessageSquare },
  PHONE: { label: "Call", Icon: Phone },
  MANUAL: { label: "Manual", Icon: MessageSquare },
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "OPEN", label: "Open" },
  { value: "PENDING", label: "Pending" },
  { value: "WAITING_FOR_REPLY", label: "Waiting" },
  { value: "QUEUED", label: "Queued" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All Priorities" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const CHANNEL_OPTIONS = [
  { value: "", label: "All Channels" },
  { value: "CHAT", label: "Live chat" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Call" },
  { value: "MANUAL", label: "Manual" },
];

const PER_PAGE_OPTIONS = [10, 25, 50];
const MENU_WIDTH = 220;
const MENU_HEIGHT = 188;
const AVATAR_TONES = ["blue", "green", "orange", "violet", "rose", "teal"];

function ticketChannel(ticket) {
  return String(ticket?.channel || ticket?.sourceChannel || "MANUAL").toUpperCase();
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

function formatCreated(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(value) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatCreated(value);
}

function lastActiveAt(ticket) {
  return (
    ticket.lastAgentResponseAt ||
    ticket.lastCustomerResponseAt ||
    ticket.updatedAt ||
    ticket.createdAt
  );
}

function agentDisplayName(user) {
  if (user?.name) return user.name;
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  if (full && user?.lastName !== "User") return full;
  return user?.email?.split("@")[0] || "Agent";
}

function buildPageList(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push("…");
    result.push(page);
  });
  return result;
}

function ChannelCell({ channel }) {
  const meta = CHANNEL_META[channel] || CHANNEL_META.MANUAL;
  const Icon = meta.Icon;
  return (
    <span className="tk-channel">
      <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export default function Tickets() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const routeChannel = CHANNEL_ROUTE[location.pathname] || "";

  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");

  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState(routeChannel);
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState(params.get("q") || "");

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState("");

  const [menuTicketId, setMenuTicketId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const triggerRefs = useRef({});

  const [assignTicketTarget, setAssignTicketTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [actionBusy, setActionBusy] = useState("");

  const openTicketId = params.get("open") || "";

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = { page: 1, limit: 100 };
      if (statusFilter) query.status = statusFilter;
      if (priorityFilter) query.priority = priorityFilter;
      if (assigneeFilter) query.assignedToUserId = assigneeFilter;
      if (channelFilter) query.channel = channelFilter;

      const result = await listTickets(query);
      setTickets(result?.data?.tickets || []);
    } catch (err) {
      setError(err.message || "Unable to load tickets");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, assigneeFilter, channelFilter]);

  const loadAgents = useCallback(async () => {
    try {
      const result = await listUsers();
      const users = result?.data?.users || [];
      setAgents(
        users.filter((user) => {
          const status = String(user.status || "").toLowerCase();
          return status === "active";
        })
      );
    } catch {
      setAgents([]);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    setChannelFilter(routeChannel);
    setPage(1);
  }, [routeChannel]);

  useEffect(() => {
    const q = params.get("q") || "";
    setSearchQuery(q);
  }, [params]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!menuTicketId) return undefined;

    function onPointerDown(event) {
      if (menuRef.current?.contains(event.target)) return;
      const trigger = triggerRefs.current[menuTicketId];
      if (trigger?.contains(event.target)) return;
      setMenuTicketId(null);
    }

    function onKey(event) {
      if (event.key === "Escape") setMenuTicketId(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuTicketId]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return tickets.filter((ticket) => {
      const channel = ticketChannel(ticket);
      if (channelFilter && channel !== channelFilter) return false;

      if (fromTs || toTs) {
        const created = new Date(ticket.createdAt).getTime();
        if (fromTs && created < fromTs) return false;
        if (toTs && created > toTs) return false;
      }

      if (!q) return true;
      const haystack = [
        ticket.ticketId,
        ticket.title,
        ticket.description,
        ticket.customer?.name,
        ticket.customer?.email,
        ticket.assignedTo?.name,
        ticket.status,
        ticket.priority,
        channel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tickets, searchQuery, channelFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, safePage, perPage]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filtered]);


  const menuTicket = useMemo(
    () => tickets.find((t) => t.id === menuTicketId || t.ticketId === menuTicketId) || null,
    [tickets, menuTicketId]
  );

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageRows.forEach((row) => next.delete(row.id));
      } else {
        pageRows.forEach((row) => next.add(row.id));
      }
      return next;
    });
  }

  function toggleRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openMenu(ticket, event) {
    event.stopPropagation();
    const key = ticket.id;
    const rect = event.currentTarget.getBoundingClientRect();
    const openUp = rect.bottom + MENU_HEIGHT > window.innerHeight - 12;
    const left = Math.min(
      Math.max(12, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 12
    );
    const top = openUp ? rect.top - MENU_HEIGHT - 6 : rect.bottom + 6;
    triggerRefs.current[key] = event.currentTarget;
    setMenuPos({ top, left });
    setMenuTicketId((current) => (current === key ? null : key));
  }

  function handleOpenTicket(ticket) {
    setMenuTicketId(null);
    navigate(channelTicketPath(ticket));
  }

  function closeDrawer() {
    const next = new URLSearchParams(params);
    next.delete("open");
    setParams(next, { replace: true });
  }

  /* Legacy ?open= links → full channel screen (no right drawer). */
  useEffect(() => {
    if (!openTicketId || !tickets.length) return;
    const ticket =
      tickets.find(
        (t) => t.ticketId === openTicketId || t.id === openTicketId
      ) || null;
    if (!ticket) return;
    navigate(channelTicketPath(ticket), { replace: true });
  }, [openTicketId, tickets, navigate]);

  function handleAssignOpen(ticket) {
    setMenuTicketId(null);
    setAssignTicketTarget(ticket);
  }

  function handleDeleteOpen(ticket) {
    setMenuTicketId(null);
    setDeleteError("");
    setDeleteTarget(ticket);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const id = deleteTarget.ticketId || deleteTarget.id;
      await updateTicketStatus(id, "CLOSED");
      setDeleteTarget(null);
      setNotice(`Ticket ${id} closed`);
      if (openTicketId === id) closeDrawer();
      await loadTickets();
    } catch (err) {
      setDeleteError(err.message || "Unable to close ticket");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function runBulkAction(value) {
    setBulkAction("");
    if (!value || selectedIds.size === 0) return;
    const targets = tickets.filter((t) => selectedIds.has(t.id));
    setActionBusy(value);
    setError("");
    try {
      if (value === "close") {
        await Promise.all(
          targets.map((ticket) =>
            updateTicketStatus(ticket.ticketId || ticket.id, "CLOSED")
          )
        );
        setNotice(`Closed ${targets.length} ticket${targets.length === 1 ? "" : "s"}`);
      } else if (value === "resolve") {
        await Promise.all(
          targets.map((ticket) =>
            updateTicketStatus(ticket.ticketId || ticket.id, "RESOLVED")
          )
        );
        setNotice(`Resolved ${targets.length} ticket${targets.length === 1 ? "" : "s"}`);
      }
      setSelectedIds(new Set());
      await loadTickets();
    } catch (err) {
      setError(err.message || "Bulk action failed");
    } finally {
      setActionBusy("");
    }
  }

  function onSearchChange(event) {
    const value = event.target.value;
    setSearchQuery(value);
    setPage(1);
    const next = new URLSearchParams(params);
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    setParams(next, { replace: true });
  }

  const pageTitle = routeChannel === "EMAIL"
    ? "Emails"
    : routeChannel === "PHONE"
      ? "Calls"
      : "All Tickets";

  const showingFrom = filtered.length ? (safePage - 1) * perPage + 1 : 0;
  const showingTo = Math.min(safePage * perPage, filtered.length);

  return (
    <div className="tickets-page">
      <header className="tickets-page__header">
        <h1 className="tickets-page__title">{pageTitle}</h1>
        <span className="tickets-page__count">{filtered.length}</span>
      </header>

      {notice ? <p className="tickets-notice">{notice}</p> : null}
      {error ? <p className="tickets-error">{error}</p> : null}

      <div className="tickets-filters">
        <select
          className="tickets-filters__select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || "all-status"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          className="tickets-filters__select"
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by priority"
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value || "all-priority"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {!routeChannel ? (
          <select
            className="tickets-filters__select"
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by channel"
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.value || "all-channel"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : null}

        <label className="tickets-filters__dates">
          <Calendar size={15} aria-hidden="true" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            aria-label="Date from"
          />
          <span>–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            aria-label="Date to"
          />
        </label>

        <select
          className="tickets-filters__select"
          value={assigneeFilter}
          onChange={(e) => {
            setAssigneeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by agent"
        >
          <option value="">All Agents</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agentDisplayName(agent)}
            </option>
          ))}
        </select>
      </div>

      <div className="tickets-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search Tickets by subject, Customers, or ticket ID..."
          aria-label="Search tickets"
        />
      </div>

      <div className="tickets-bulk">
        <label className="tickets-bulk__label">
          <input
            type="checkbox"
            checked={allPageSelected}
            onChange={toggleSelectAll}
            aria-label="Select all tickets on this page"
          />
          Select all
        </label>
        <select
          value={bulkAction}
          disabled={selectedIds.size === 0 || Boolean(actionBusy)}
          onChange={(e) => runBulkAction(e.target.value)}
          aria-label="Bulk actions"
        >
          <option value="">
            {actionBusy
              ? "Working…"
              : selectedIds.size
                ? `Bulk Actions (${selectedIds.size})`
                : "Bulk Actions"}
          </option>
          <option value="resolve">Mark resolved</option>
          <option value="close">Close selected</option>
        </select>
      </div>

      <section className="tickets-panel">
        <div className="tickets-table-wrap">
          <table className="tickets-table">
            <thead>
              <tr>
                <th className="tickets-table__check" aria-label="Select" />
                <th>#</th>
                <th>Subject</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Channel</th>
                <th>Assignee</th>
                <th>Created</th>
                <th>Last active</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11}>
                    <p className="tickets-empty">Loading tickets…</p>
                  </td>
                </tr>
              ) : pageRows.length ? (
                pageRows.map((ticket) => {
                  const channel = ticketChannel(ticket);
                  const assigneeName = ticket.assignedTo?.name || "";
                  const customerName =
                    ticket.customer?.name || ticket.customer?.email || "—";
                  const selected = selectedIds.has(ticket.id);

                  return (
                    <tr key={ticket.id} className={selected ? "is-selected" : undefined}>
                      <td className="tickets-table__check">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRow(ticket.id)}
                          aria-label={`Select ${ticket.ticketId}`}
                        />
                      </td>
                      <td>
                        <a
                          href={channelTicketPath(ticket)}
                          className="tickets-table__id"
                          onClick={(event) => {
                            event.preventDefault();
                            handleOpenTicket(ticket);
                          }}
                        >
                          {formatTicketId(ticket.ticketId)}
                        </a>
                      </td>
                      <td>
                        <div className="tickets-table__subject" title={ticket.title}>
                          {ticket.title}
                        </div>
                      </td>
                      <td className="tickets-table__customer">{customerName}</td>
                      <td>
                        <span className={`tk-status tk-status--${statusTone(ticket.status)}`}>
                          {statusLabel(ticket.status)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`tk-priority tk-priority--${priorityTone(ticket.priority)}`}
                        >
                          <span className="tk-priority__dot" aria-hidden="true" />
                          {priorityLabel(ticket.priority)}
                        </span>
                      </td>
                      <td>
                        <ChannelCell channel={channel} />
                      </td>
                      <td>
                        {assigneeName ? (
                          <span className="tk-assignee">
                            <span
                              className={`tk-avatar tk-avatar--sm tone-${avatarTone(assigneeName)}`}
                              aria-hidden="true"
                            >
                              {initialsFromName(assigneeName)}
                            </span>
                            {assigneeName}
                          </span>
                        ) : (
                          <span className="tickets-table__muted">Unassigned</span>
                        )}
                      </td>
                      <td className="tickets-table__muted">
                        {formatCreated(ticket.createdAt)}
                      </td>
                      <td className="tickets-table__muted">
                        {formatRelative(lastActiveAt(ticket))}
                      </td>
                      <td>
                        <div className="tickets-row-actions">
                          <button
                            type="button"
                            className={`tickets-row-actions__btn${
                              menuTicketId === ticket.id ? " is-open" : ""
                            }`}
                            aria-label={`Actions for ${ticket.ticketId}`}
                            aria-expanded={menuTicketId === ticket.id}
                            onClick={(event) => openMenu(ticket, event)}
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11}>
                    <p className="tickets-empty">
                      {tickets.length
                        ? "No tickets match your filters."
                        : "No tickets in your workspace yet. Create the first one."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="tickets-footer">
          <p className="tickets-footer__meta">
            Showing {showingFrom}–{showingTo} of {filtered.length} tickets
          </p>

          <div className="tickets-pagination">
            <button
              type="button"
              className="tickets-pagination__btn"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            {buildPageList(safePage, totalPages).map((item, index) =>
              item === "…" ? (
                <span key={`e-${index}`} className="tickets-pagination__ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`tickets-pagination__btn${
                    item === safePage ? " is-active" : ""
                  }`}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              className="tickets-pagination__btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <select
            className="tickets-footer__per-page"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Rows per page"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
        </footer>
      </section>

      {menuTicket
        ? createPortal(
            <div
              ref={menuRef}
              className="tk-menu"
              style={{ top: menuPos.top, left: menuPos.left }}
              role="menu"
            >
              <p className="tk-menu__title">Ticket actions</p>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleOpenTicket(menuTicket)}
              >
                <UserSearch size={15} aria-hidden="true" />
                Open
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleAssignOpen(menuTicket)}
              >
                <Clock size={15} aria-hidden="true" />
                Transfer
              </button>
              <div className="tk-menu__divider" role="separator" />
              <button
                type="button"
                className="tk-menu__danger"
                role="menuitem"
                onClick={() => handleDeleteOpen(menuTicket)}
              >
                <UserX size={15} aria-hidden="true" />
                Delete
              </button>
            </div>,
            document.body
          )
        : null}

      {assignTicketTarget ? (
        <TransferTicketModal
          ticket={assignTicketTarget}
          onClose={() => setAssignTicketTarget(null)}
          onTransferred={async (agent) => {
            setAssignTicketTarget(null);
            setNotice(`Ticket transferred to ${agent.name}`);
            await loadTickets();
          }}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmActionModal
          title={`Close ${deleteTarget.ticketId}?`}
          message="This marks the ticket as closed. You can reopen it later from the status workflow if needed."
          confirmLabel="Close ticket"
          tone="danger"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => {
            if (!deleteBusy) {
              setDeleteTarget(null);
              setDeleteError("");
            }
          }}
        />
      ) : null}
    </div>
  );
}
