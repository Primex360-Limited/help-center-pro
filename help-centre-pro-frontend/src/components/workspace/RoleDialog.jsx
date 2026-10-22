import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { permissionKeysOf } from "../../constants/rolePermissions.js";
import { useDialogChrome } from "./dialogUtils.js";

/**
 * Create / Edit Role — permission matrix (Module × Create/Read/Update/Delete)
 * mapped onto the canonical backend permission catalog. Keys outside the
 * matrix (advanced grants) are preserved untouched when editing.
 */
const MATRIX = [
  {
    module: "Tickets",
    actions: {
      create: "ticket:create",
      read: "ticket:read",
      update: "ticket:update",
      delete: "ticket:close",
    },
  },
  {
    module: "Customers",
    actions: { create: null, read: "message:create", update: "note:create", delete: null },
  },
  {
    module: "Agents",
    actions: {
      create: "agent:invite",
      read: "agent:read",
      update: "agent:update",
      delete: "agent:deactivate",
    },
  },
  {
    module: "Templates",
    actions: {
      create: "template:create",
      read: "template:read",
      update: "template:update",
      delete: "template:delete",
    },
  },
  {
    module: "Automations",
    actions: {
      create: "ticket:assign",
      read: "ticket:transfer",
      update: "ticket:pick",
      delete: "ticket:supervise",
    },
  },
  {
    module: "Analytics",
    actions: { create: null, read: "report:read", update: null, delete: null },
  },
  {
    module: "Billing & Invoices",
    actions: { create: null, read: "role:read", update: "role:manage", delete: null },
  },
  {
    module: "Settings",
    actions: { create: null, read: "settings:read", update: "settings:write", delete: null },
  },
  {
    module: "Reports",
    actions: { create: null, read: "report:read", update: null, delete: null },
  },
];

const MATRIX_KEYS = new Set(
  MATRIX.flatMap((row) => Object.values(row.actions).filter(Boolean))
);
const ACTION_COLUMNS = ["create", "read", "update", "delete"];

export default function RoleDialog({
  open,
  mode = "create",
  role = null,
  submitting = false,
  error = "",
  onClose,
  onSubmit,
}) {
  const isEdit = mode === "edit";
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState(() => new Set());
  const [fieldError, setFieldError] = useState("");

  useDialogChrome(open, onClose);

  useEffect(() => {
    if (!open) return;
    setName(role?.name || "");
    setPermissions(new Set(permissionKeysOf(role)));
    setFieldError("");
  }, [open, role]);

  const preservedCount = useMemo(
    () => [...permissions].filter((key) => !MATRIX_KEYS.has(key)).length,
    [permissions]
  );

  function togglePermission(key) {
    setPermissions((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setFieldError("Give this role a name with at least 3 characters.");
      return;
    }
    if (permissions.size === 0) {
      setFieldError("Select at least one permission for this role.");
      return;
    }
    onSubmit({
      name: trimmed,
      description: role?.description || "",
      permissions: Array.from(permissions),
    });
  }

  if (!open) return null;

  const message = fieldError || error;

  return createPortal(
    <div
      className="um-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="um-role-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div className="um-modal um-modal--matrix">
        <h2 id="um-role-dialog-title" className="um-matrix__title">
          {isEdit ? "Edit Role" : "Create Role"}
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          {message ? (
            <p className="um-alert um-alert--error" role="alert">
              {message}
            </p>
          ) : null}

          <label className="um-matrix__label" htmlFor="um-role-name">
            Role name
          </label>
          <input
            id="um-role-name"
            className="um-matrix__input"
            type="text"
            value={name}
            maxLength={48}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter role name"
            autoComplete="off"
            autoFocus
          />

          <span className="um-matrix__label">Enable Permissions</span>
          <div className="um-matrix-wrap">
            <table className="um-matrix">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Create</th>
                  <th>Read</th>
                  <th>Update</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.module}>
                    <td className="um-matrix__module">{row.module}</td>
                    {ACTION_COLUMNS.map((action) => {
                      const key = row.actions[action];
                      if (!key) {
                        return (
                          <td key={action} className="um-matrix__dash">
                            –
                          </td>
                        );
                      }
                      const checked = permissions.has(key);
                      return (
                        <td key={action}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            aria-label={`${row.module} ${action}`}
                            className={`um-matrix__check${checked ? " is-checked" : ""}`}
                            onClick={() => togglePermission(key)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preservedCount > 0 ? (
            <p className="um-matrix__note">
              + {preservedCount} advanced permission{preservedCount === 1 ? "" : "s"} on this
              role are kept as-is.
            </p>
          ) : null}

          <div className="um-matrix__footer">
            <span className="um-matrix__count">
              {permissions.size} permission{permissions.size === 1 ? "" : "s"} selected
            </span>
            <div className="um-matrix__actions">
              <button
                type="button"
                className="um-matrix__cancel"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="um-matrix__submit" disabled={submitting}>
                {submitting
                  ? isEdit
                    ? "Saving…"
                    : "Creating…"
                  : isEdit
                    ? "Save changes"
                    : "Create role"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
