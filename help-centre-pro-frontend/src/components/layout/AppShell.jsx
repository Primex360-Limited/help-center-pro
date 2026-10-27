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
  Menu,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { updateMyPhone, updateMySenderEmail } from "../../api/auth.api.js";
import { MODULE_ACCESS, COMING_SOON_MODULES } from "../../constants/moduleAccess.js";
import { useAuth } from "../../context/AuthContext.jsx";
import HowItWorksCard from "./HowItWorksCard.jsx";
import SidebarBrand from "./SidebarBrand.jsx";
import "../../styles/app.css";

/** Exact sidebar order from the tenant dashboard mock. */
const TENANT_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true, module: "dashboard" },
  { to: "/tickets", label: "Tickets", icon: Ticket, end: true, module: "tickets" },
  { to: "/tickets/live-chat", label: "Live Chat", icon: MessageSquare, module: "liveChat" },
  { to: "/tickets/emails", label: "Emails", icon: Mail, module: "emails" },
  { to: "/tickets/calls", label: "Calls", icon: Phone, module: "calls" },
  { to: "/customers", label: "Customers", icon: Users, module: "customers" },
  { to: "/agents", label: "Agents", icon: UserRound, module: "agents" },
  { to: "/analytics", label: "Analytics", icon: PieChart, module: "analytics" },
  { to: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
  { to: "/templates", label: "Templates", icon: FileText, module: "templates" },
  { to: "/automations", label: "Automations", icon: Zap, module: "automations" },
  { to: "/workspace/settings/billing", label: "Billing", icon: CreditCard, module: "billing" },
  {
    to: "/workspace/user-management",
    label: "User management",
    icon: Users,
    module: "userManagement",
  },
  { to: "/workspace/profile", label: "Settings", icon: Settings, module: "settings" },
];

function tenantRoleLabel(roleName) {
  if (!roleName) return "Team member";
  if (roleName === "Super Admin" || roleName === "Tenant Admin" || roleName === "Admin") {
    return "Administrator";
  }
  return roleName;
}

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  const { pathname } = useLocation();
  const onBilling =
    pathname.startsWith("/workspace/settings/billing") || pathname === "/billing";
  const onSettingsArea =
    pathname === "/workspace/profile" ||
    pathname.startsWith("/workspace/settings/") ||
    pathname.startsWith("/workspace/email-settings") ||
    pathname.startsWith("/workspace/voip-settings");
  const forceActive =
    (item.module === "billing" && onBilling) ||
    (item.module === "settings" && onSettingsArea && !onBilling);

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `app-nav__item${isActive || forceActive ? " is-active" : ""}`
      }
      onClick={onNavigate}
    >
      <Icon size={18} strokeWidth={1.75} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function AppShell() {
  const { user, logout, hasAnyPermission, refreshUser } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [howtoDismissed, setHowtoDismissed] = useState(false);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [agentPhone, setAgentPhone] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState("");

  useEffect(() => {
    setHowtoDismissed(localStorage.getItem("hcp_howto_dismissed") === "1");
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [navOpen]);

  const visibleNav = useMemo(() => {
    return TENANT_NAV.filter((item) => {
      if (COMING_SOON_MODULES.has(item.module)) return false;
      const keys = MODULE_ACCESS[item.module] || [];
      if (!keys.length) return false;
      return hasAnyPermission(keys);
    });
  }, [hasAnyPermission]);

  const canCreateTicket = hasAnyPermission(["ticket:create", "ticket:read"]);

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
    setNavOpen(false);
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
    <div className={`app-shell${navOpen ? " is-nav-open" : ""}`}>
      <button
        type="button"
        className={`app-nav-backdrop${navOpen ? " is-open" : ""}`}
        aria-label="Close menu"
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />

      <aside
        className="app-sidebar"
        aria-label="Primary"
        id="app-mobile-nav"
      >
        <div className="app-sidebar__scroll">
          <div className="app-sidebar__brand-row">
            <SidebarBrand variant="tenant" />
            <button
              type="button"
              className="app-sidebar__close"
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="app-nav" aria-label="Workspace">
            {visibleNav.map((item) => (
              <NavItem
                key={item.key || item.to + item.label}
                item={item}
                onNavigate={() => setNavOpen(false)}
              />
            ))}
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
          <button
            type="button"
            className="app-menu-btn"
            aria-label="Open menu"
            aria-expanded={navOpen}
            aria-controls="app-mobile-nav"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={20} />
          </button>
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
            {canCreateTicket ? (
              <button
                type="button"
                className="app-new-ticket"
                onClick={() => navigate("/tickets/new")}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span className="app-new-ticket__label">New Ticket</span>
              </button>
            ) : null}
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
