import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

function roleLabel(name = "") {
  if (name === "Tenant Admin") return "Admin";
  if (name === "Tenant Agent") return "Agent";
  if (name === "Tenant Supervisor") return "Supervisor";
  if (name === "Admin") return "Admin";
  if (name === "Agent") return "Agent";
  return name;
}

export default function AddAgentModal({
  roles = [],
  submitting = false,
  error = "",
  onClose,
  onSubmit,
}) {
  const assignableRoles = useMemo(
    () =>
      roles.filter((role) =>
        ["Tenant Admin", "Tenant Agent", "Tenant Supervisor", "Admin", "Agent"].includes(
          role.name
        )
      ),
    [roles]
  );

  const defaultRoleId =
    assignableRoles.find((role) => role.name === "Tenant Agent" || role.name === "Agent")
      ?.id ||
    assignableRoles[0]?.id ||
    "";

  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(defaultRoleId);

  useEffect(() => {
    if (!roleId && defaultRoleId) setRoleId(defaultRoleId);
  }, [defaultRoleId, roleId]);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      email: email.trim(),
      roleId,
    });
  }

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-agent-title">
      <div className="admin-modal">
        <button type="button" className="admin-modal__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <h2 id="add-agent-title">Add a New Agent</h2>
        <p className="admin-modal__sub">
          Add a new agent to your help center team.
        </p>

        <form className="admin-form" onSubmit={handleSubmit}>
          {error ? <p className="auth-error">{error}</p> : null}

          <div>
            <label htmlFor="invite-email">Email Address</label>
            <input
              id="invite-email"
              type="email"
              placeholder="agent@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="invite-role">Role</label>
            <select
              id="invite-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              required
            >
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {roleLabel(role.name)}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-form__actions">
            <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={submitting || !roleId}>
              {submitting ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
