import logo from "../../assets/helpcentre-pro-logo.png";
import { APP_NAME } from "../../config/env.js";

export default function BrandLogo({ compact = false }) {
  return (
    <div className={`auth-brand${compact ? " auth-brand--compact" : ""}`}>
      <img
        className="auth-brand__logo"
        src={logo}
        alt={APP_NAME}
        draggable="false"
      />
    </div>
  );
}
