import logoDefault from "../../assets/helpcentre-pro-logo.png";
import logoOnDark from "../../assets/helpcentre-pro-logo-light.png";
import { APP_NAME } from "../../config/env.js";

/**
 * Premium brand mark (transparent PNG).
 * - Default: colour logo for light surfaces (image 1 / 2)
 * - light: wordmark for dark full-bleed surfaces
 * - size: "sm" for auth cards (matches design comps)
 */
export default function BrandLogo({
  compact = false,
  light = false,
  size = "md",
  showTagline = false,
}) {
  const src = light ? logoOnDark : logoDefault;
  const sizeClass =
    size === "sm" || compact
      ? " auth-brand--sm"
      : size === "lg"
        ? " auth-brand--lg"
        : "";

  return (
    <div
      className={`auth-brand${sizeClass}${light ? " auth-brand--light" : ""}${
        showTagline ? " auth-brand--tagline" : ""
      }`}
    >
      <img
        className="auth-brand__logo"
        src={src}
        alt={APP_NAME}
        draggable="false"
      />
      {showTagline ? (
        <p className="auth-brand__tagline">Unified Support. Happier Customers.</p>
      ) : null}
    </div>
  );
}
