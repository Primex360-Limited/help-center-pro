import lockup from "../../assets/helpcentre-pro-sidebar-lockup.png";
import mark from "../../assets/helpcentre-pro-mark.png";
import { APP_NAME } from "../../config/env.js";

/**
 * Sidebar brand lockup.
 * - tenant: full white "hc + Help Center Pro" lockup (Image 1) on the blue rail
 * - admin: compact mark + wordmark for the dark admin rail
 */
export default function SidebarBrand({ variant = "tenant" } = {}) {
  if (variant === "admin") {
    return (
      <div className="sidebar-brand sidebar-brand--admin" title={APP_NAME}>
        <img
          className="sidebar-brand__mark"
          src={mark}
          alt=""
          width={36}
          height={36}
          draggable="false"
        />
        <div className="sidebar-brand__copy">
          <div className="sidebar-brand__name">Help Center Pro</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-brand sidebar-brand--tenant" title={APP_NAME}>
      <img
        className="sidebar-brand__lockup"
        src={lockup}
        alt="Help Center Pro"
        draggable="false"
      />
    </div>
  );
}
