import { Clock, ShieldCheck, X } from "lucide-react";

export default function InviteSentModal({ email, roleLabel = "", onClose }) {
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

        <h2 id="invite-sent-title">Agent invitation sent</h2>
        <p className="admin-modal__sub">
          An activation link is on its way to <strong>{email}</strong>
          {roleLabel ? (
            <>
              {" "}
              with the <strong>{roleLabel}</strong> role
            </>
          ) : null}
          . They&apos;ll appear here as <strong>Pending</strong> until they
          activate.
        </p>

        <ul className="invite-sent__facts">
          <li>
            <Clock size={15} aria-hidden="true" />
            The activation link expires 48 hours after it was sent.
          </li>
          <li>
            <ShieldCheck size={15} aria-hidden="true" />
            Single-use only — accepting it consumes the link for good.
          </li>
        </ul>

        <div className="admin-form__actions" style={{ justifyContent: "center", marginTop: "24px" }}>
          <button type="button" className="admin-btn admin-btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

