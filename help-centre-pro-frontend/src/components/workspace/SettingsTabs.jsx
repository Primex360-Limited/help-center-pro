import { NavLink } from "react-router-dom";
import { Building2, Mail, Phone } from "lucide-react";

/** Premium settings navigation shared by Workspace Profile and Email Accounts. */
export default function SettingsTabs() {
  return (
    <nav className="settings-tabs" aria-label="Settings sections">
      <NavLink
        to="/workspace/profile"
        className={({ isActive }) =>
          `settings-tab${isActive ? " is-active" : ""}`
        }
      >
        <Building2 size={16} />
        Workspace Profile
      </NavLink>
      <NavLink
        to="/workspace/email-settings"
        className={({ isActive }) =>
          `settings-tab${isActive ? " is-active" : ""}`
        }
      >
        <Mail size={16} />
        Email Accounts
        <span className="settings-tab__badge">Two-way sync</span>
      </NavLink>
      <NavLink
        to="/workspace/voip-settings"
        className={({ isActive }) =>
          `settings-tab${isActive ? " is-active" : ""}`
        }
      >
        <Phone size={16} />
        VoIP / SIP
        <span className="settings-tab__badge">Call providers</span>
      </NavLink>
    </nav>
  );
}
