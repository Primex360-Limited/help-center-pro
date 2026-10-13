import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import BrandLogo from "../../components/auth/BrandLogo.jsx";
import { tenantLoginPath } from "../../config/env.js";
import "../../styles/auth.css";
import "../../styles/admin.css";

/**
 * Shown on the tenant host when someone probes admin-only paths.
 * Intentionally does not reveal the Admin Portal URL.
 */
export default function PortalAccessDenied({
  title = "Restricted area",
  message = "This area is reserved for HelpCentre Pro platform operators and is not available on the workspace application.",
}) {
  const home = tenantLoginPath();

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <BrandLogo />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span className="admin-login-badge">
            <Lock size={12} />
            Secure zone
          </span>
        </div>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-subtitle">{message}</p>
        <div className="auth-footer-pill" style={{ marginTop: 8 }}>
          <span>
            {home.startsWith("http") ? (
              <a href={home}>Return to workspace sign in</a>
            ) : (
              <Link to={home}>Return to workspace sign in</Link>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
