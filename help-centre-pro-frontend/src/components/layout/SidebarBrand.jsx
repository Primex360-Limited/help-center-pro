import mark from "../../assets/helpcentre-pro-mark.png";
import { APP_NAME } from "../../config/env.js";

export default function SidebarBrand() {
  return (
    <div className="sidebar-brand" title={APP_NAME}>
      <img
        className="sidebar-brand__mark"
        src={mark}
        alt=""
        width={40}
        height={40}
        draggable="false"
      />
      <div className="sidebar-brand__copy">
        <div className="sidebar-brand__name">
          HelpCentre <span>Pro</span>
        </div>
        <div className="sidebar-brand__tag">Unified Support</div>
      </div>
    </div>
  );
}
