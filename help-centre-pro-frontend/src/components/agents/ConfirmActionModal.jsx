import { AlertTriangle, CheckCircle2, X } from "lucide-react";

/**
 * Premium confirm dialog used for destructive team actions
 * (deactivate / reactivate an agent).
 */
export default function ConfirmActionModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  error = "",
  onConfirm,
  onClose,
}) {
  return (
    <div
      className="admin-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
    >
      <div className="admin-modal admin-modal--confirm">
        <button
          type="button"
          className="admin-modal__close"
          onClick={onClose}
          aria-label="Close"
          disabled={busy}
        >
          <X size={18} />
        </button>

        <div
          className={`confirm-action__icon confirm-action__icon--${tone}`}
          aria-hidden="true"
        >
          {tone === "primary" ? (
            <CheckCircle2 size={22} />
          ) : (
            <AlertTriangle size={22} />
          )}
        </div>

        <h2 id="confirm-action-title">{title}</h2>
        <p className="admin-modal__sub">{message}</p>

        {error ? (
          <p className="auth-error" style={{ marginTop: 14 }}>
            {error}
          </p>
        ) : null}

        <div className="admin-form__actions" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`admin-btn ${tone === "primary" ? "admin-btn--primary" : "admin-btn--danger"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
