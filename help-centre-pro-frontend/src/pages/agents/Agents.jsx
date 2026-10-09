import { useCallback, useEffect, useMemo, useState } from "react";
import { inviteUser } from "../../api/invitations.api.js";
import { listRoles } from "../../api/roles.api.js";
import { deleteUser, listUsers, updateUser } from "../../api/users.api.js";
import "../../styles/app.css";
import "../../styles/auth.css";

const emptyInvite = {
  firstName: "",
  lastName: "",
  email: "",
  roleId: "",
};

export default function Agents() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [invite, setInvite] = useState(emptyInvite);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [devInvite, setDevInvite] = useState(null);

  const assignableRoles = useMemo(
    () =>
      roles.filter((role) =>
        ["Admin", "Agent", "Tenant Admin", "Tenant Supervisor", "Tenant Agent"].includes(
          role.name
        )
      ),
    [roles]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, rolesRes] = await Promise.all([listUsers(), listRoles()]);
      setUsers(usersRes?.data?.users || []);
      setRoles(
        (rolesRes?.data?.roles || []).map((role) => ({
          ...role,
          id: role.id || role._id,
        }))
      );
    } catch (err) {
      setError(err.message || "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!invite.roleId && assignableRoles.length) {
      const agentRole =
        assignableRoles.find((role) => role.name === "Agent") || assignableRoles[0];
      setInvite((prev) => ({ ...prev, roleId: agentRole.id }));
    }
  }, [assignableRoles, invite.roleId]);

  async function handleInvite(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    setDevInvite(null);

    try {
      const result = await inviteUser({
        firstName: invite.firstName.trim(),
        lastName: invite.lastName.trim(),
        email: invite.email.trim(),
        roleId: invite.roleId,
      });

      const invitation = result?.data?.invitation;
      setNotice("Invitation sent successfully.");
      if (invitation?.inviteToken || invitation?.temporaryPassword) {
        setDevInvite({
          token: invitation.inviteToken,
          temporaryPassword: invitation.temporaryPassword,
        });
      }
      setInvite((prev) => ({ ...emptyInvite, roleId: prev.roleId }));
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to invite user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(user, status) {
    setError("");
    try {
      await updateUser(user.id || user._id, { status });
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to update user");
    }
  }

  async function handleRoleChange(user, roleId) {
    setError("");
    try {
      await updateUser(user.id || user._id, { roleId });
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to update role");
    }
  }

  async function handleDelete(user) {
    if (!window.confirm(`Remove ${user.email} from the workspace?`)) return;
    setError("");
    try {
      await deleteUser(user.id || user._id);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to delete user");
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="panel">
        <div className="panel__header">
          <div>
            <h2>Invite agent or admin</h2>
            <p>
              Send a secure invite. New teammates set access via email and a
              temporary password.
            </p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleInvite}>
          <div className="field">
            <label htmlFor="invite-first">First name</label>
            <input
              id="invite-first"
              value={invite.firstName}
              onChange={(e) =>
                setInvite((prev) => ({ ...prev, firstName: e.target.value }))
              }
              required
            />
          </div>
          <div className="field">
            <label htmlFor="invite-last">Last name</label>
            <input
              id="invite-last"
              value={invite.lastName}
              onChange={(e) =>
                setInvite((prev) => ({ ...prev, lastName: e.target.value }))
              }
              required
            />
          </div>
          <div className="field">
            <label htmlFor="invite-email">Email</label>
            <input
              id="invite-email"
              type="email"
              value={invite.email}
              onChange={(e) =>
                setInvite((prev) => ({ ...prev, email: e.target.value }))
              }
              required
            />
          </div>
          <div className="field">
            <label htmlFor="invite-role">Role</label>
            <select
              id="invite-role"
              value={invite.roleId}
              onChange={(e) =>
                setInvite((prev) => ({ ...prev, roleId: e.target.value }))
              }
              required
            >
              <option value="" disabled>
                Select role
              </option>
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="full">
            <button className="primary-btn" type="submit" disabled={submitting}>
              {submitting ? "Sending invite..." : "Send invitation"}
            </button>
          </div>
        </form>

        {error ? (
          <p className="auth-error" style={{ marginTop: 16 }}>
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="auth-success" style={{ marginTop: 16 }}>
            {notice}
          </p>
        ) : null}
        {devInvite ? (
          <div className="inline-note">
            <strong>Local development invite details</strong>
            <div>Temp password: {devInvite.temporaryPassword}</div>
            <div>
              Accept link:{" "}
              {`${window.location.origin}/accept-invitation?token=${devInvite.token}`}
            </div>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2>Team members</h2>
            <p>Manage agent status, roles, and access.</p>
          </div>
          <button className="ghost-btn" type="button" onClick={loadData}>
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="auth-subtitle">Loading team...</p>
        ) : (
          <div className="table-wrap">
            <table className="agents-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const id = user.id || user._id;
                  const roleName = user.role?.name || "Unassigned";
                  const status = user.status || "active";
                  return (
                    <tr key={id}>
                      <td>
                        {user.firstName} {user.lastName}
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <select
                          value={user.role?.id || user.roleId || ""}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          disabled={roleName === "Super Admin"}
                        >
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`badge badge--${status}`}>{status}</span>
                      </td>
                      <td>
                        <div className="row-actions">
                          {status !== "active" ? (
                            <button
                              className="ghost-btn"
                              type="button"
                              onClick={() => handleStatusChange(user, "active")}
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              className="ghost-btn"
                              type="button"
                              onClick={() => handleStatusChange(user, "inactive")}
                            >
                              Deactivate
                            </button>
                          )}
                          {roleName !== "Super Admin" ? (
                            <button
                              className="danger-btn"
                              type="button"
                              onClick={() => handleDelete(user)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
