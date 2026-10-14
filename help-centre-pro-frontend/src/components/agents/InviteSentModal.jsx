import { X } from "lucide-react";

export default function InviteSentModal({ email, onClose }) {
  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="invite-sent-title">
      <div className="admin-modal admin-modal--wide" style={{ textAlign: "center", paddingTop: "36px" }}>
        <button type="button" className="admin-modal__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="invite-medal" aria-hidden="true">
          <div className="invite-medal__ribbon" />
          <div className="invite-medal__badge">
            <div className="invite-medal__check">✓</div>
          </div>
        </div>

        <h2 id="invite-sent-title">Invite Sent</h2>
        <p className="admin-modal__sub">
          You have successfully sent an invitation to{" "}
          <strong>{email}</strong>
        </p>

        <div className="admin-form__actions" style={{ justifyContent: "center", marginTop: "24px" }}>
          <button type="button" className="admin-btn admin-btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
