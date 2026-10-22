import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Ticket,
  MessageSquare,
  Mail,
  Phone,
  Users,
  BarChart3,
  UserRound,
  FileText,
  Zap,
  Bell,
  Plus,
  Search,
  LogOut,
  CreditCard,
  PieChart,
  Settings,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { updateMyPhone, updateMySenderEmail } from "../../api/auth.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import HowItWorksCard from "./HowItWorksCard.jsx";
import SidebarBrand from "./SidebarBrand.jsx";
import "../../styles/app.css";

/** Exact sidebar order from the tenant dashboard mock. */
const TENANT_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true, ready: true },
  { to: "/tickets", label: "Tickets", icon: Ticket, end: true, ready: true },
  { to: "/tickets/live-chat", label: "Live Chat", icon: MessageSquare, ready: true },
  { to: "/tickets/emails", label: "Emails", icon: Mail, ready: true },
  { to: "/tickets/calls", label: "Calls", icon: Phone, ready: true },
  { to: "/customers", label: "Customers", icon: Users, ready: true },
  { to: "/agents", label: "Agents", icon: UserRound, ready: true, needsUsers: true },
  { to: "/analytics", label: "Analytics", icon: PieChart, ready: false },
  { to: "/reports", label: "Reports", icon: BarChart3, ready: false },
  { to: "/templates", label: "Templates", icon: FileText, ready: true },
  { to: "/automations", label: "Automations", icon: Zap, ready: true, needsPermission: "ticket:transfer" },
  { to: "/billing", label: "Billing", icon: CreditCard, ready: false },
  { to: "/workspace/user-management", label: "User management", icon: Users, ready: true, needsUsers: true },
  { to: "/workspace/profile", label: "Settings", icon: Settings, ready: true, needsSettings: true },
];

function tenantRoleLabel(roleName) {
  if (!roleName) return "Team member";
  if (roleName === "Super Admin" || roleName === "Tenant Admin" || roleName === "Admin") {
    return "Administrator";
  }
  return roleName;
}

function NavItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `app-nav__item${isActive ? " is-active" : ""}`
      }
    >
      <Icon size={18} strokeWidth={1.75} />
      <span>{item.label}</span>
    </NavLink>
  );
}

function ComingSoonNav({ item }) {
  const Icon = item.icon;
  return (
    <button type="button" className="app-nav__item app-nav__item--soon" disabled>
      <Icon size={18} strokeWidth={1.75} />
      <span>{item.label}</span>
    </button>
  );
}

export default function AppShell() {
  const {
    user,
    logout,
    canManageUsers,
    canManageSettings,
    hasPermission,
    refreshUser,
  } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [howtoDismissed, setHowtoDismissed] = useState(false);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [agentPhone, setAgentPhone] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState("");

  useEffect(() => {
    setHowtoDismissed(localStorage.getItem("hcp_howto_dismissed") === "1");
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function dismissHowto() {
    localStorage.setItem("hcp_howto_dismissed", "1");
    setHowtoDismissed(true);
  }

  function openProfile() {
    setAgentPhone(user?.phoneNumber || "");
    setSenderEmail(user?.metadata?.senderEmail || "");
    setPhoneMsg("");
    setProfileOpen(true);
  }

  async function saveAgentPhone(event) {
    event.preventDefault();
    setSavingPhone(true);
    setPhoneMsg("");
    try {
      await updateMyPhone(agentPhone.trim() || null);
      await updateMySenderEmail(senderEmail.trim() || null);
      await refreshUser();
      setPhoneMsg("Saved. Your call and email sender settings are live.");
    } catch (err) {
      setPhoneMsg(err.message || "Unable to save settings");
    } finally {
      setSavingPhone(false);
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const q = search.trim();
    navigate(q ? `/tickets?q=${encodeURIComponent(q)}` : "/tickets");
  }

  const displayName = useMemo(
    () => [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User",
    [user]
  );
  const roleLabel = tenantRoleLabel(user?.roleName);
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "U";

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__scroll">
          <SidebarBrand />

          <nav className="app-nav" aria-label="Workspace">
            {TENANT_NAV.map((item) => {
              const key = item.key || item.to + item.label;
              if (item.needsUsers && !canManageUsers) {
                return <ComingSoonNav key={key} item={item} />;
              }
              if (item.needsSettings && !canManageSettings) {
                return <ComingSoonNav key={key} item={item} />;
              }
              /**
               * Pages the user may never open are hidden rather than disabled —
               * a dead link in the sidebar is worse than no link.
               */
              if (item.needsPermission && !hasPermission(item.needsPermission)) {
                return null;
              }
              return item.ready ? (
                <NavItem key={key} item={item} />
              ) : (
                <ComingSoonNav key={key} item={item} />
              );
            })}
          </nav>
        </div>

        <div className="app-sidebar__bottom">
          {!howtoDismissed ? <HowItWorksCard onDismiss={dismissHowto} /> : null}

          <div className="app-sidebar__profile">
            <div className="app-sidebar__avatar" aria-hidden="true">
              {user?.profileImage ? (
                <img src={user.profileImage} alt="" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <button
              type="button"
              className="app-sidebar__profile-meta app-sidebar__profile-btn"
              onClick={openProfile}
              title="My profile — agent phone for calls"
            >
              <div className="app-sidebar__profile-name">{displayName}</div>
              <div className="app-sidebar__profile-role">{roleLabel}</div>
            </button>
            <button
              type="button"
              className="app-sidebar__logout"
              onClick={handleLogout}
              aria-label={t("nav.logout")}
              title={t("nav.logout")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <form className="app-search" onSubmit={handleSearchSubmit}>
            <Search size={16} strokeWidth={2} />
            <input
              type="search"
              placeholder="Search Tickets, Customers"
              aria-label="Search Tickets, Customers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <div className="app-topbar__actions">
            <button type="button" className="app-icon-btn" aria-label="Notifications">
              <Bell size={18} />
              <span className="app-icon-btn__dot" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="app-new-ticket"
              onClick={() => navigate("/tickets/new")}
            >
              <Plus size={16} strokeWidth={2.5} />
              New Ticket
            </button>
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {profileOpen ? (
        <div
          className="app-profile-modal"
          role="dialog"
          aria-modal="true"
          aria-label="My profile"
          onClick={() => setProfileOpen(false)}
        >
          <form
            className="app-profile-modal__panel"
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveAgentPhone}
          >
            <h2>My profile</h2>
            <p className="app-profile-modal__sub">
              {displayName} · {user?.email || ""}
            </p>
            <label htmlFor="agent-phone-setting">Agent phone (for calls)</label>
            <input
              id="agent-phone-setting"
              value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value)}
              placeholder="+234 803 123 4567"
              autoComplete="tel"
            />
            <p className="app-profile-modal__hint">
              When set, outbound calls ring this handset first, then connect
              the customer on any network. Leave empty to talk from this
              browser via your HelpCentre Pro line.
            </p>
            <label
              htmlFor="agent-sender-email-setting"
              style={{ marginTop: 16 }}
            >
              Sender email (for customer emails)
            </label>
            <input
              id="agent-sender-email-setting"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              autoComplete="email"
            />
            <p className="app-profile-modal__hint">
              Display sender for customer emails. For full two-way sync,
              connect your mailbox in Settings → Email — replies then send
              from your real address and appear in your Sent folder. Leave
              empty to use your workspace support email.
            </p>
            {phoneMsg ? (
              <p className="app-profile-modal__msg">{phoneMsg}</p>
            ) : null}
            <div className="app-profile-modal__actions">
              <button
                type="button"
                className="app-profile-modal__ghost"
                onClick={() => setProfileOpen(false)}
              >
                Close
              </button>
              <button
                type="submit"
                className="app-profile-modal__primary"
                disabled={savingPhone}
              >
                {savingPhone ? "Saving…" : "Save settings"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
