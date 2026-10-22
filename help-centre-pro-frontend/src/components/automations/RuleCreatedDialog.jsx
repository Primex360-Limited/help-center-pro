import { X } from "lucide-react";
import { useDialogChrome } from "../workspace/dialogUtils.js";
import RuleCreatedBadge from "./RuleCreatedBadge.jsx";

/**
 * Success confirmation shown right after a rule is created. Deliberately has a
 * single exit (close / backdrop / Escape) — the list behind it is already
 * refreshed, so there is nothing else to decide.
 */
export default function RuleCreatedDialog({ open = true, onClose }) {
  useDialogChrome(open, onClose);

  if (!open) return null;

  return (
    <div
      className="automation-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="automation-dialog automation-dialog--success"
        role="dialog"
        aria-modal="true"
        aria-labelledby="automation-created-title"
        aria-describedby="automation-created-copy"
      >
        <button
          type="button"
          className="automation-dialog__close automation-dialog__close--floating"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} strokeWidth={1.9} />
        </button>

        <RuleCreatedBadge className="automation-dialog__badge" />

        <h2 id="automation-created-title">Rule created</h2>
        <p id="automation-created-copy">
          A new automation rule has been created
        </p>
      </div>
    </div>
  );
}
