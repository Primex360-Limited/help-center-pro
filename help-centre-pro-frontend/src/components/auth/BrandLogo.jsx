import logo from "../../assets/helpcentre-pro-logo.png";
import { APP_NAME } from "../../config/env.js";

export default function BrandLogo({
  compact = false,
  light = false,
  showTagline = false,
}) {
  return (
    <div
      className={`auth-brand${compact ? " auth-brand--compact" : ""}${
        light ? " auth-brand--light" : ""
      }${showTagline ? " auth-brand--tagline" : ""}`}
    >
      <img
        className="auth-brand__logo"
        src={logo}
        alt={APP_NAME}
        draggable="false"
      />
      {showTagline ? (
        <p className="auth-brand__tagline">Unified Support. Happier Customers.</p>
      ) : null}
    </div>
  );
}
