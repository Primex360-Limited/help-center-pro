import { X } from "lucide-react";

export default function InviteSentModal({ email, onClose }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="invite-sent-title">
      <div className="modal-card modal-card--success">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="invite-medal" aria-hidden="true">
          <div className="invite-medal__ribbon" />
          <div className="invite-medal__badge">
            <div className="invite-medal__check">✓</div>
          </div>
        </div>

        <h2 id="invite-sent-title">Invite Sent</h2>
        <p>
          You have successfully sent an invitation to{" "}
          <strong>{email}</strong>
        </p>
      </div>
    </div>
  );
}
