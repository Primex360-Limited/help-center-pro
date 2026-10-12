import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Plus } from "lucide-react";
import { inviteUser } from "../../api/invitations.api.js";
import { listRoles } from "../../api/roles.api.js";
import { listUsers } from "../../api/users.api.js";
import AddAgentModal from "../../components/agents/AddAgentModal.jsx";
import InviteSentModal from "../../components/agents/InviteSentModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/app.css";
import "../../styles/auth.css";
import "../../styles/agents.css";

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
        return (
          user.userType !== "provider" &&
          !roleName.includes("Provider")
        );
      }),
    [users]
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

  return (
    <div className="agents-page">
      <header className="agents-page__header">
        <div>
          <h1>Agents</h1>
          <p>Manage your support Team and Agents.</p>
        </div>
        {canInvite ? (
          <button
            type="button"
            className="primary-btn agents-page__add"
            onClick={() => {
              setModalError("");
              setShowAddModal(true);
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Add New Agent
          </button>
        ) : null}
      </header>

      {error ? <p className="dashboard__error">{error}</p> : null}

      {loading ? (
        <p className="dash-empty">Loading agents...</p>
      ) : agents.length ? (
        <div className="agents-grid">
          {agents.map((user) => {
            const stats = user.ticketStats || {
              assigned: 0,
              open: 0,
              resolved: 0,
            };
            const pending = user.status === "invited";
            return (
              <article key={user.id || user.email} className="agent-card">
                {pending ? <span className="agent-card__pending">Pending</span> : null}
                <div className="agent-card__top">
                  <div className="agent-card__avatar" aria-hidden="true">
                    {initials(user)}
                  </div>
                  <div className="agent-card__identity">
                    <div className="agent-card__name-row">
                      <h3>{displayName(user)}</h3>
                      <span className={`agent-card__role agent-card__role--${roleChip(user.role?.name)}`}>
                        {roleLabel(user.role?.name)}
                      </span>
                    </div>
                    <div className="agent-card__email">
                      <Mail size={14} />
                      <span>{user.email}</span>
                    </div>
                  </div>
                </div>
                <div className="agent-card__stats">
                  <div>
                    <strong>{stats.assigned}</strong>
                    <span>Assigned</span>
                  </div>
                  <div>
                    <strong className="is-open">{stats.open}</strong>
                    <span>Open</span>
                  </div>
                  <div>
                    <strong className="is-resolved">{stats.resolved}</strong>
                    <span>Resolved</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="agents-empty">
          <p>No agents in this workspace yet.</p>
          {canInvite ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={16} />
              Add New Agent
            </button>
          ) : null}
        </div>
      )}

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
