import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import "../../styles/settings-premium.css";

/** Integration hub — matches mock empty state with branded mark + docs CTA. */
export default function IntegrationsSettings() {
  return (
    <section className="settings-card">
      <div className="settings-integration-empty">
        <div className="settings-integration-mark" aria-hidden="true">
          S
        </div>
        <div>
          <h2 className="settings-card__title" style={{ textAlign: "center" }}>
            Integration
          </h2>
          <p
            className="settings-card__desc"
            style={{ textAlign: "center", maxWidth: 420, margin: "8px auto 0" }}
          >
            Connect your chat widget with API keys: start a visitor chat, send
            messages, and poll GET /public/widget/messages for agent replies.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          <Link to="/docs/integration" className="settings-btn settings-btn--primary">
            <ExternalLink size={16} />
            Open integration docs
          </Link>
          <Link
            to="/workspace/settings/api-tokens"
            className="settings-btn settings-btn--secondary"
          >
            Manage API tokens
          </Link>
        </div>
      </div>
    </section>
  );
}
