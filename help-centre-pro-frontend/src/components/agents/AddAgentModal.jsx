import { useEffect, useMemo, useState } from "react";
import { Mail, ShieldCheck, UserPlus, X } from "lucide-react";
import PremiumSelect from "../auth/PremiumSelect.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Friendly labels for known system role names; custom roles keep their name. */
export function roleDisplayLabel(name = "") {
  if (name === "Tenant Admin" || name === "Admin") return "Admin";
  if (name === "Tenant Supervisor" || name === "Supervisor") return "Supervisor";
  if (name === "Tenant Agent" || name === "Agent") return "Agent";
  return name || "Agent";
}

function isProviderRole(role = {}) {
  const name = String(role.name || "");
  return (
    role.scope === "provider" ||
    name.includes("Provider") ||
    name === "Super Admin"
  );
}

/**
 * Roles the tenant may assign: every workspace role from the API except
 * platform/provider operators. Custom roles created by admins appear here.
 */
function assignableFrom(roles = []) {
  return roles.filter((role) => role?.id && !isProviderRole(role));
}

export default function AddAgentModal({
  roles = [],
  submitting = false,
  error = "",
  onClose,
  onSubmit,
}) {
  const assignableRoles = useMemo(() => assignableFrom(roles), [roles]);

  const defaultRoleId =
    assignableRoles.find(
      (role) =>
        role.name === "Tenant Agent" ||
        role.name === "Agent" ||
        roleDisplayLabel(role.name).toLowerCase() === "agent"
    )?.id ||
    assignableRoles[0]?.id ||
    "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(defaultRoleId);
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    if (!roleId && defaultRoleId) setRoleId(defaultRoleId);
  }, [defaultRoleId, roleId]);

  const selectedRole = assignableRoles.find((role) => role.id === roleId) || null;

  function handleSubmit(event) {
    event.preventDefault();
    setFieldError("");

    if (firstName.trim().length < 2) {
      setFieldError("Enter the agent's first name");
      return;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldError("Enter a valid work email address");
      return;
    }

    if (!roleId) {
      setFieldError("Select a role for this agent");
      return;
    }

    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      roleId,
    });
  }

  const message = fieldError || error;

  return (
    <div
      className="admin-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-agent-title"
    >
      <div className="admin-modal admin-modal--agent">
        <button
          type="button"
          className="admin-modal__close"
          onClick={onClose}
          aria-label="Close"
          disabled={submitting}
        >
          <X size={18} />
        </button>

        <div className="add-agent__head">
          <div className="add-agent__icon" aria-hidden="true">
            <UserPlus size={20} />
          </div>
          <div>
            <h2 id="add-agent-title">Add a new agent</h2>
            <p className="admin-modal__sub">
              We email a secure activation link. It expires in 48 hours and can
              only be used once.
            </p>
          </div>
        </div>

        <form className="admin-form" onSubmit={handleSubmit} noValidate>
          {message ? <p className="auth-error">{message}</p> : null}

          <div className="admin-form__row">
            <div>
              <label htmlFor="agent-first-name">First name</label>
              <input
                id="agent-first-name"
                type="text"
                placeholder="Ada"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="off"
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="agent-last-name">Last name</label>
              <input
                id="agent-last-name"
                type="text"
                placeholder="Okafor"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label htmlFor="agent-email">Work email</label>
            <div className="add-agent__input">
              <Mail size={16} aria-hidden="true" />
              <input
                id="agent-email"
                type="email"
                placeholder="agent@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="agent-role">Role</label>
            <PremiumSelect
              id="agent-role"
              value={roleId}
              onChange={setRoleId}
              options={assignableRoles.map((role) => ({
                value: role.id,
                label: roleDisplayLabel(role.name),
              }))}
              placeholder={
                assignableRoles.length
                  ? "Select a role"
                  : "No roles available yet"
              }
              disabled={submitting || !assignableRoles.length}
            />
            <p className="add-agent__hint">
              <ShieldCheck size={14} aria-hidden="true" />
              {selectedRole
                ? `Assigns the “${roleDisplayLabel(selectedRole.name)}” role from your workspace.`
                : "Roles come from your workspace — including any custom roles your admin created."}
            </p>
          </div>

          <div className="admin-form__actions">
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn--primary"
              disabled={submitting || !assignableRoles.length}
            >
              {submitting ? "Sending invite…" : "Create Agent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
