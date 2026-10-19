import mark from "../../assets/helpcentre-pro-mark.png";
import { APP_NAME } from "../../config/env.js";

/** Tenant sidebar lockup — matches dashboard mock. */
export default function SidebarBrand() {
  return (
    <div className="sidebar-brand" title={APP_NAME}>
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
