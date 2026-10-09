import logo from "../../assets/helpcentre-pro-logo.png";
import logoLight from "../../assets/helpcentre-pro-logo-light.png";
import { APP_NAME } from "../../config/env.js";

export default function BrandLogo({ variant = "dark", compact = false }) {
  const src = variant === "light" ? logoLight : logo;

  return (
    <div className={`auth-brand${compact ? " auth-brand--compact" : ""}`}>
      <img
        className="auth-brand__logo"
        src={src}
        alt={APP_NAME}
        draggable="false"
      />
    </div>
  );
}
