import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { inviteUser } from "../../api/invitations.api.js";
import { listRoles } from "../../api/roles.api.js";
import {
  activateUser,
  deactivateUser,
  listUsers,
} from "../../api/users.api.js";
import AddAgentModal, {
  roleDisplayLabel,
} from "../../components/agents/AddAgentModal.jsx";
import ConfirmActionModal from "../../components/agents/ConfirmActionModal.jsx";
import InviteSentModal from "../../components/agents/InviteSentModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { downloadCsv } from "../../utils/csv.js";
import "../../styles/app.css";
import "../../styles/auth.css";
import "../../styles/agents.css";
import "../../styles/admin.css";

/** Portal-rendered row menu, sized like the platform tenant menu. */
const MENU_WIDTH = 208;
const MENU_ESTIMATED_HEIGHT = 168;

const ROLE_FILTERS = [
  { value: "all", label: "All roles" },
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "agent", label: "Agent" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending invite" },
  { value: "inactive", label: "Deactivated" },
];

const STATUS_META = {
  active: { label: "Active", tone: "active" },
  pending: { label: "Pending invite", tone: "provisioning" },
  inactive: { label: "Deactivated", tone: "inactive" },
  suspended: { label: "Suspended", tone: "suspended" },
};

function displayName(user) {
  const local = user.email?.split("@")[0] || "";
  if (!user.lastName || user.lastName === "User") {
    return local || user.firstName || "Agent";
  }
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || local || "Agent";
}

function initials(user) {
  const name = displayName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function roleKind(roleName = "") {
  if (roleName === "Tenant Admin" || roleName === "Admin") return "admin";
  if (roleName === "Tenant Supervisor" || roleName === "Supervisor") {
    return "supervisor";
  }
  return "agent";
}

/** Maps both Phase-1 (`invited`) and legacy (`pending`) statuses. */
function normalizedStatus(user) {
  const raw = String(user?.status || "").toLowerCase();
  if (raw === "active") return "active";
  if (raw === "invited" || raw === "pending") return "pending";
  if (raw === "suspended") return "suspended";
  return "inactive";
}

function formatJoined(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function csvFilename() {
  const stamp = new Date().toISOString().slice(0, 10);
  return `help-centre-pro-team-${stamp}.csv`;
}

export default function Agents() {
  const { hasPermission } = useAuth();
  const canInvite = hasPermission("agent:invite");
  const canDeactivate = hasPermission("agent:deactivate");

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [inviteSent, setInviteSent] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [menuFor, setMenuFor] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, openUp: false });
  const [actionBusy, setActionBusy] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [actionError, setActionError] = useState("");

  const menuRef = useRef(null);
  const triggerRefs = useRef({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, rolesRes] = await Promise.all([
        listUsers({ includeStats: true }),
        listRoles(),
      ]);
      setUsers(usersRes?.data?.users || []);
      setRoles(
        (rolesRes?.data?.roles || []).map((role) => ({
          ...role,
          id: role.id || role._id,
        }))
      );
    } catch (err) {
      setError(err.message || "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(() => setBanner(""), 4500);
    return () => clearTimeout(timer);
  }, [banner]);

  /** Workspace teammates only — provider operators are never listed here. */
  const team = useMemo(
    () =>
      users.filter(
        (user) =>
          user.userType !== "provider" &&
          !(user.role?.name || "").includes("Provider")
      ),
    [users]
  );

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return team
      .filter((user) => {
        const roleName = user.role?.name || "";
        const status = normalizedStatus(user);
        const matchesSearch =
          !query ||
          displayName(user).toLowerCase().includes(query) ||
          String(user.email || "").toLowerCase().includes(query);
        const matchesRole =
          roleFilter === "all" || roleKind(roleName) === roleFilter;
        const matchesStatus =
          statusFilter === "all" || status === statusFilter;

        return matchesSearch && matchesRole && matchesStatus;
      })
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [team, searchQuery, roleFilter, statusFilter]);

  const kpis = useMemo(
    () => ({
      total: team.length,
      active: team.filter((user) => normalizedStatus(user) === "active").length,
      pending: team.filter((user) => normalizedStatus(user) === "pending").length,
      admins: team.filter((user) => roleKind(user.role?.name) === "admin").length,
    }),
    [team]
  );

  const filtersActive =
    searchQuery.trim() !== "" || roleFilter !== "all" || statusFilter !== "all";

  const activeMenuUser = useMemo(
    () => filtered.find((user) => (user.id || user.email) === menuFor) || null,
    [filtered, menuFor]
  );

  const closeMenu = useCallback(() => setMenuFor(null), []);

  const positionMenu = useCallback((key) => {
    const trigger = triggerRefs.current[key];
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < MENU_ESTIMATED_HEIGHT + 12;
    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8
    );
    const top = openUp
      ? Math.max(8, rect.top - MENU_ESTIMATED_HEIGHT - 6)
      : rect.bottom + 6;

    setMenuPos({ top, left, openUp });
  }, []);

  function openActions(key) {
    if (menuFor === key) {
      closeMenu();
      return;
    }
    positionMenu(key);
    setMenuFor(key);
  }

  useEffect(() => {
    if (!menuFor) return undefined;

    function onDocClick(event) {
      const menu = menuRef.current;
      const trigger = triggerRefs.current[menuFor];
      if (menu?.contains(event.target) || trigger?.contains(event.target)) return;
      closeMenu();
    }

    function onReposition() {
      positionMenu(menuFor);
    }

    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [menuFor, closeMenu, positionMenu]);

  function resetFilters() {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  async function handleInvite({ firstName, lastName, email, roleId }) {
    setSubmitting(true);
    setModalError("");
    try {
      await inviteUser({ email, firstName, lastName, roleId });
      const roleName = roles.find((role) => role.id === roleId)?.name || "";
      setShowAddModal(false);
      setInviteSent({ email, roleLabel: roleDisplayLabel(roleName) });
      setBanner(`Invitation sent to ${email}`);
      await loadData();
    } catch (err) {
      setModalError(err.message || "Unable to send invitation");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyEmail(user) {
    closeMenu();
    try {
      await navigator.clipboard.writeText(user.email || "");
      setBanner(`Copied ${user.email}`);
    } catch {
      setError("Copying to the clipboard is blocked by this browser");
    }
  }

  function handleExportCsv() {
    setError("");

    if (!filtered.length) {
      setError("Nothing to export — adjust the filters and try again");
      return;
    }

    const rows = filtered.map((user) => {
      const stats = user.ticketStats || {};
      return {
        name: displayName(user),
        email: user.email || "",
        role: roleDisplayLabel(user.role?.name),
        status: STATUS_META[normalizedStatus(user)].label,
        assigned: Number(stats.assigned || 0),
        open: Number(stats.open || 0),
        resolved: Number(stats.resolved || 0),
        joined: user.createdAt
          ? new Date(user.createdAt).toISOString().slice(0, 10)
          : ""
      };
    });

    downloadCsv(
      csvFilename(),
      [
        { label: "Name", value: "name" },
        { label: "Email", value: "email" },
        { label: "Role", value: "role" },
        { label: "Status", value: "status" },
        { label: "Assigned tickets", value: "assigned" },
        { label: "Open tickets", value: "open" },
        { label: "Resolved tickets", value: "resolved" },
        { label: "Joined", value: "joined" }
      ],
      rows
    );

    setBanner(`Exported ${rows.length} teammate${rows.length === 1 ? "" : "s"}`);
  }

  function requestStatusChange(user, nextStatus) {
    closeMenu();
    setActionError("");
    setConfirmTarget({ user, nextStatus });
  }

  async function confirmStatusChange() {
    if (!confirmTarget) return;

    const { user, nextStatus } = confirmTarget;
    const key = user.id || user.email;

    setActionBusy(key);
    setActionError("");
    try {
      if (nextStatus === "active") {
        await activateUser(key);
      } else {
        await deactivateUser(key);
      }
      setConfirmTarget(null);
      setBanner(
        `${displayName(user)} ${
          nextStatus === "active" ? "reactivated" : "deactivated"
        }`
      );
      await loadData();
    } catch (err) {
      setActionError(err.message || "Unable to update this teammate");
    } finally {
      setActionBusy("");
    }
  }

  const confirmPerson = confirmTarget ? displayName(confirmTarget.user) : "";
  const confirmIsActivate = confirmTarget?.nextStatus === "active";

  const kpiCards = [
    {
      key: "total",
      label: "Team members",
      value: kpis.total,
      meta: "Everyone in this workspace",
      icon: <Users size={16} />,
      tone: "accent",
    },
    {
      key: "active",
      label: "Active",
      value: kpis.active,
      meta: "Can sign in and work tickets",
      icon: <CheckCircle2 size={16} />,
      tone: "active",
    },
    {
      key: "pending",
      label: "Pending invites",
      value: kpis.pending,
      meta: "Waiting on a 48-hour link",
      icon: <UserPlus size={16} />,
      tone: "pending",
    },
    {
      key: "admins",
      label: "Admins",
      value: kpis.admins,
      meta: "Full workspace control",
      icon: <ShieldCheck size={16} />,
      tone: "admin",
    },
  ];

  return (
    <div className="agents-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title" style={{ marginBottom: 4 }}>
            Agent Management
          </h1>
          <p className="admin-kpi__meta">
            Manage your support team, their roles and workspace access
          </p>
        </div>
        <div className="admin-page-actions">
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={handleExportCsv}
            disabled={loading || !filtered.length}
            title="Download the teammates currently shown"
          >
            <Download size={16} />
            Export CSV
          </button>
          {canInvite ? (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => {
                setModalError("");
                setShowAddModal(true);
              }}
            >
              <Plus size={16} />
              Add Agent
            </button>
          ) : null}
        </div>
      </div>

      {banner ? (
        <p className="agents-banner" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {banner}
        </p>
      ) : null}

      <div className="admin-kpi-grid agents-kpi-grid">
        {kpiCards.map((card) => (
          <div
            key={card.key}
            className={`admin-card agents-kpi agents-kpi--${card.tone}`}
          >
            <span className="agents-kpi__icon" aria-hidden="true">
              {card.icon}
            </span>
            <p className="admin-kpi__label">{card.label}</p>
            <p className="admin-kpi__value">{card.value}</p>
            <p className="admin-kpi__meta">{card.meta}</p>
          </div>
        ))}
      </div>

      <div className="admin-filters">
        <div className="admin-filters__search">
          <Search size={16} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search name or email..."
            aria-label="Search agents"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          aria-label="Filter by role"
        >
          {ROLE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {filtersActive ? (
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={resetFilters}
          >
            <X size={15} />
            Clear
          </button>
        ) : null}
        <p className="agents-filters__count">
          {filtered.length} of {team.length} shown
        </p>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table agents-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Role</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>Open</th>
              <th>Resolved</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <p className="admin-empty">Loading agents...</p>
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((user) => {
                const key = user.id || user.email;
                const status = normalizedStatus(user);
                const meta = STATUS_META[status];
                const stats = user.ticketStats || {
                  assigned: 0,
                  open: 0,
                  resolved: 0,
                };

                return (
                  <tr key={key}>
                    <td>
                      <div className="admin-workspace">
                        <div className="admin-workspace__mark">
                          {initials(user)}
                        </div>
                        <div>
                          <p className="admin-workspace__name">
                            {displayName(user)}
                          </p>
                          <p className="admin-workspace__meta">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`agent-role-badge agent-role-badge--${roleKind(
                          user.role?.name
                        )}`}
                      >
                        {roleDisplayLabel(user.role?.name)}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-status admin-status--${meta.tone}`}>
                        {meta.label}
                      </span>
                      {status === "pending" ? (
                        <p className="agents-table__hint">
                          Invited {formatJoined(user.createdAt)}
                        </p>
                      ) : null}
                    </td>
                    <td>{Number(stats.assigned || 0)}</td>
                    <td>{Number(stats.open || 0)}</td>
                    <td>{Number(stats.resolved || 0)}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-row-actions__btn"
                          aria-label={`Actions for ${displayName(user)}`}
                          aria-expanded={menuFor === key}
                          ref={(node) => {
                            if (node) triggerRefs.current[key] = node;
                            else delete triggerRefs.current[key];
                          }}
                          onClick={() => openActions(key)}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>
                  <p className="admin-empty">
                    {team.length
                      ? "No teammates match your filters."
                      : "No agents in this workspace yet."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="agents-note">
        <ShieldCheck size={15} aria-hidden="true" />
        Invitations send a single-use activation link that expires after 48
        hours. Teammates stay pending until they accept it.
      </p>

      {activeMenuUser
        ? createPortal(
            <div
              ref={menuRef}
              className={`admin-menu admin-menu--portal${menuPos.openUp ? " is-up" : ""}`}
              style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
              role="menu"
            >
              <button
                type="button"
                className="edit"
                role="menuitem"
                onClick={() => handleCopyEmail(activeMenuUser)}
              >
                <Copy size={14} style={{ marginRight: 8 }} />
                Copy email
              </button>

              {canDeactivate &&
              normalizedStatus(activeMenuUser) !== "pending" ? (
                normalizedStatus(activeMenuUser) === "active" ? (
                  <button
                    type="button"
                    className="deactivate"
                    role="menuitem"
                    disabled={
                      actionBusy === (activeMenuUser.id || activeMenuUser.email)
                    }
                    onClick={() =>
                      requestStatusChange(activeMenuUser, "inactive")
                    }
                  >
                    <Ban size={14} style={{ marginRight: 8 }} />
                    Deactivate access
                  </button>
                ) : (
                  <button
                    type="button"
                    className="activate"
                    role="menuitem"
                    disabled={
                      actionBusy === (activeMenuUser.id || activeMenuUser.email)
                    }
                    onClick={() => requestStatusChange(activeMenuUser, "active")}
                  >
                    <CheckCircle2 size={14} style={{ marginRight: 8 }} />
                    Reactivate access
                  </button>
                )
              ) : null}
            </div>,
            document.body
          )
        : null}

      {showAddModal ? (
        <AddAgentModal
          roles={roles}
          submitting={submitting}
          error={modalError}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleInvite}
        />
      ) : null}

      {inviteSent ? (
        <InviteSentModal
          email={inviteSent.email}
          roleLabel={inviteSent.roleLabel}
          onClose={() => setInviteSent(null)}
        />
      ) : null}

      {confirmTarget ? (
        <ConfirmActionModal
          title={
            confirmIsActivate
              ? `Reactivate ${confirmPerson}?`
              : `Deactivate ${confirmPerson}?`
          }
          message={
            confirmIsActivate
              ? `${confirmPerson} will regain access to the shared queue and their assigned tickets.`
              : `${confirmPerson} loses access immediately, including any active session. Their tickets stay in the workspace and access can be restored later.`
          }
          confirmLabel={confirmIsActivate ? "Reactivate" : "Deactivate"}
          tone={confirmIsActivate ? "primary" : "danger"}
          busy={
            actionBusy === (confirmTarget.user.id || confirmTarget.user.email)
          }
          error={actionError}
          onConfirm={confirmStatusChange}
          onClose={() => {
            setConfirmTarget(null);
            setActionError("");
          }}
        />
      ) : null}
    </div>
  );
}




