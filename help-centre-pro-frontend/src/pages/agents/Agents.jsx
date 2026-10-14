import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Plus, Search } from "lucide-react";
import { inviteUser } from "../../api/invitations.api.js";
import { listRoles } from "../../api/roles.api.js";
import { listUsers, activateUser, deactivateUser } from "../../api/users.api.js";
import AddAgentModal from "../../components/agents/AddAgentModal.jsx";
import InviteSentModal from "../../components/agents/InviteSentModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/app.css";
import "../../styles/auth.css";
import "../../styles/agents.css";
import "../../styles/admin.css";

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

function roleChip(roleName = "") {
  if (roleName.includes("Admin") || roleName === "Admin") return "admin";
  if (roleName.includes("Supervisor")) return "supervisor";
  return "agent";
}

function roleLabel(roleName = "") {
  if (roleName === "Tenant Admin" || roleName === "Admin") return "admin";
  if (roleName === "Tenant Supervisor") return "supervisor";
  if (roleName === "Tenant Agent" || roleName === "Agent") return "agent";
  return (roleName || "agent").toLowerCase();
}

function roleDisplayLabel(roleName = "") {
  if (roleName === "Tenant Admin" || roleName === "Admin") return "Admin";
  if (roleName === "Tenant Supervisor") return "Supervisor";
  if (roleName === "Tenant Agent" || roleName === "Agent") return "Agent";
  return roleName || "Agent";
}

export default function Agents() {
  const { hasPermission } = useAuth();
  const canInvite = hasPermission("agent:invite");

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [inviteSentEmail, setInviteSentEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionBusy, setActionBusy] = useState("");

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

  const agents = useMemo(
    () =>
      users.filter((user) => {
        const roleName = user.role?.name || "";
        const matchesSearch =
          !searchQuery ||
          displayName(user).toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchQuery.toLowerCase());
        return (
          user.userType !== "provider" &&
          !roleName.includes("Provider") &&
          matchesSearch
        );
      }),
    [users, searchQuery]
  );

  async function handleInvite({ email, roleId }) {
    setSubmitting(true);
    setModalError("");
    try {
      await inviteUser({ email, roleId });
      setShowAddModal(false);
      setInviteSentEmail(email);
      await loadData();
    } catch (err) {
      setModalError(err.message || "Unable to send invitation");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivate(userId) {
    setActionBusy(userId);
    try {
      await activateUser(userId);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to activate agent");
    } finally {
      setActionBusy("");
    }
  }

  async function handleDeactivate(userId) {
    setActionBusy(userId);
    try {
      await deactivateUser(userId);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to deactivate agent");
    } finally {
      setActionBusy("");
    }
  }

  return (
    <div className="agents-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Agent Management</h1>
          <p className="admin-kpi__meta">Manage your support team and their permissions</p>
        </div>
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

      <div className="admin-filters">
        <div className="admin-filters__search">
          <Search size={16} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agent..."
          />
        </div>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Role</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>Open</th>
              <th>Resolved</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <p className="admin-empty">Loading agents...</p>
                </td>
              </tr>
            ) : agents.length ? (
              agents.map((user) => {
                const stats = user.ticketStats || {
                  assigned: 0,
                  open: 0,
                  resolved: 0,
                };
                const isActive = user.status === "active";
                const isAdmin = roleLabel(user.role?.name) === "admin";
                return (
                  <tr key={user.id || user.email}>
                    <td>
                      <div className="admin-workspace">
                        <div className="admin-workspace__mark">
                          {initials(user)}
                        </div>
                        <div>
                          <p className="admin-workspace__name">
                            {displayName(user)}
                          </p>
                          <p className="admin-workspace__meta">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`agent-role-badge ${isAdmin ? "agent-role-badge--admin" : ""}`}
                      >
                        {roleDisplayLabel(user.role?.name)}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-status admin-status--${isActive ? "active" : "inactive"}`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{stats.assigned}</td>
                    <td>{stats.open}</td>
                    <td>{stats.resolved}</td>
                    <td>
                      <div className="agent-actions">
                        {isActive ? (
                          <button
                            type="button"
                            className="agent-action-btn agent-action-btn--deactivate"
                            onClick={() => handleDeactivate(user.id)}
                            disabled={actionBusy === user.id}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="agent-action-btn agent-action-btn--activate"
                            onClick={() => handleActivate(user.id)}
                            disabled={actionBusy === user.id}
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>
                  <p className="admin-empty">No agents in this workspace yet.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal ? (
        <AddAgentModal
          roles={roles}
          submitting={submitting}
          error={modalError}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleInvite}
        />
      ) : null}

      {inviteSentEmail ? (
        <InviteSentModal
          email={inviteSentEmail}
          onClose={() => setInviteSentEmail("")}
        />
      ) : null}
    </div>
  );
}
