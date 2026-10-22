import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Lock, UserCog, X } from "lucide-react";
import { useDialogChrome, avatarStyle, initialsOf } from "./dialogUtils.js";
import {
  displayNameOf,
  normalizedStatus,
  roleDisplayName,
} from "./memberUtils.js";

const STATUS_OPTIONS = [
  { value: "active", label: "Active", hint: "Can sign in and work tickets" },
  {
    value: "suspended",
    label: "Suspended",
    hint: "Blocked until reactivated",
  },
  {
    value: "inactive",
    label: "Deactivated",
    hint: "Access revoked, history kept",
  },
];

const STATUS_LABELS = {
  active: "Active",
  pending: "Pending invite",
  suspended: "Suspended",
  inactive: "Deactivated",
};

function isProviderRole(role) {
  const name = String(role?.name || "");
  return (
    name === "Super Admin" || name.includes("Provider") || role?.scope === "provider"
  );
}

/**
 * Fully wired member editor.
 *
 * `onSubmit` receives a sparse patch so the API only gets fields that actually
 * changed - status is omitted for pending invitees because they are not part of
 * the `UserStatus` enum until they accept.
 */
export default function EditMemberModal({
  open,
  member,
  roles = [],
  submitting = false,
  error = "",
  onClose,
  onSubmit,
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("active");
  const [fieldError, setFieldError] = useState("");

  useDialogChrome(open, onClose);

  useEffect(() => {
    if (!open || !member) return;
    setFirstName(member.firstName || "");
    setLastName(member.lastName || "");
    setPhoneNumber(member.phoneNumber || "");
    setRoleId(member.roleId || member.role?.id || "");
    setStatus(
      normalizedStatus(member) === "pending" ? "active" : normalizedStatus(member)
    );
    setFieldError("");
  }, [open, member]);

  const assignableRoles = useMemo(
    () => roles.filter((role) => role?.id && !isProviderRole(role)),
    [roles]
  );

  const isPending = normalizedStatus(member) === "pending";

  function handleSubmit(event) {
    event.preventDefault();
    setFieldError("");

    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      setFieldError("First name can't be empty.");
      return;
    }

    const payload = {};

    if (trimmedFirst !== (member?.firstName || "")) payload.firstName = trimmedFirst;

    const trimmedLast = lastName.trim();
    if (trimmedLast !== (member?.lastName || "")) payload.lastName = trimmedLast;

    const trimmedPhone = phoneNumber.trim();
    if (trimmedPhone !== (member?.phoneNumber || "")) {
      payload.phoneNumber = trimmedPhone;
    }

    const currentRoleId = member?.roleId || member?.role?.id || "";
    if (roleId !== currentRoleId) payload.roleId = roleId || null;

    if (!isPending && status !== normalizedStatus(member)) payload.status = status;

    if (Object.keys(payload).length === 0) {
      setFieldError("Nothing has changed yet - update a field to save.");
      return;
    }

    onSubmit(payload);
  }

  if (!open || !member) return null;

  const personName = displayNameOf(member);
  const message = fieldError || error;

  return createPortal(
    <div
      className="um-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="um-member-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div className="um-modal um-modal--member">
        <header className="um-modal__head">
          <div className="um-modal__identity">
            <span className="um-modal__icon" aria-hidden="true">
              <UserCog size={21} />
            </span>
            <div>
              <h2 id="um-member-dialog-title">Edit member</h2>
              <p>Update profile details, access level and account status.</p>
            </div>
          </div>
          <button
            type="button"
            className="um-modal__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </header>

        <form className="um-member-form" onSubmit={handleSubmit} noValidate>
          <div className="um-modal__body">
            <div className="um-member-preview">
              <span
                className="um-avatar um-avatar--lg"
                style={avatarStyle(member.email || personName)}
                aria-hidden="true"
              >
                {initialsOf(member.firstName, member.lastName)}
              </span>
              <div className="um-member-preview__text">
                <strong>{personName}</strong>
                <span>{member.email}</span>
              </div>
              <span className={`um-status um-status--${normalizedStatus(member)}`}>
                <span className="um-status__dot" aria-hidden="true" />
                {STATUS_LABELS[normalizedStatus(member)]}
              </span>
            </div>

            {message ? (
              <p className="um-alert um-alert--error" role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                {message}
              </p>
            ) : null}

            <div className="um-form-row">
              <div className="um-field">
                <div className="um-field__label">
                  <label htmlFor="um-member-first">First name</label>
                </div>
                <input
                  id="um-member-first"
                  className="um-input"
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="given-name"
                  autoFocus
                  required
                />
              </div>

              <div className="um-field">
                <div className="um-field__label">
                  <label htmlFor="um-member-last">Last name</label>
                </div>
                <input
                  id="um-member-last"
                  className="um-input"
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="um-field">
              <div className="um-field__label">
                <label htmlFor="um-member-email">Email address</label>
                <Lock size={13} aria-hidden="true" />
              </div>
              <input
                id="um-member-email"
                className="um-input"
                type="email"
                value={member.email || ""}
                readOnly
                disabled
              />
              <p className="um-hint">
                Email is the sign-in identity and can't be changed here.
              </p>
            </div>

            <div className="um-field">
              <div className="um-field__label">
                <label htmlFor="um-member-phone">
                  Phone number <span className="um-field__optional">Optional</span>
                </label>
              </div>
              <input
                id="um-member-phone"
                className="um-input"
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="+1 555 0100"
                autoComplete="tel"
              />
            </div>

            <div className="um-field">
              <div className="um-field__label">
                <label htmlFor="um-member-role">Assigned role</label>
              </div>
              <div className="um-select">
                <select
                  id="um-member-role"
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                  disabled={!assignableRoles.length}
                >
                  <option value="">No role assigned</option>
                  {assignableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {roleDisplayName(role.name)}
                    </option>
                  ))}
                </select>
              </div>
              <p className="um-hint">
                The role decides which permissions this member inherits.
              </p>
            </div>

            <div className="um-field">
              <div className="um-field__label">
                <span id="um-member-status-label">Account status</span>
              </div>
              <div
                className={`um-segmented${isPending ? " is-disabled" : ""}`}
                role="radiogroup"
                aria-labelledby="um-member-status-label"
              >
                {STATUS_OPTIONS.map((option) => {
                  const active = !isPending && status === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`um-segmented__option${active ? " is-active" : ""}`}
                      onClick={() => setStatus(option.value)}
                      disabled={isPending || submitting}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="um-hint">
                {isPending
                  ? "This member hasn't accepted their invitation yet - status unlocks after activation."
                  : STATUS_OPTIONS.find((option) => option.value === status)?.hint}
              </p>
            </div>
          </div>

          <footer className="um-modal__footer">
            <span className="um-modal__footer-note">
              Changes are applied immediately.
            </span>
            <div className="um-modal__actions">
              <button
                type="button"
                className="um-btn um-btn--ghost"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="um-btn um-btn--primary"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="um-spinner" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}

