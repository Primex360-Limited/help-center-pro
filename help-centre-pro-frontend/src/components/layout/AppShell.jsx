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
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
  { to: "/customers", label: "Customers", icon: Users, ready: false },
  { to: "/agents", label: "Agents", icon: UserRound, ready: true, needsUsers: true },
  { to: "/analytics", label: "Analytics", icon: PieChart, ready: false },
  { to: "/reports", label: "Reports", icon: BarChart3, ready: false },
  { to: "/templates", label: "Templates", icon: FileText, ready: false },
  { to: "/automations", label: "Automations", icon: Zap, ready: false },
  { to: "/billing", label: "Billing", icon: CreditCard, ready: false },
  // User management + Settings hidden for now (Agents covers team access)
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
  const { user, logout, canManageUsers } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [howtoDismissed, setHowtoDismissed] = useState(false);
  const [search, setSearch] = useState("");

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
            <div className="app-sidebar__profile-meta">
              <div className="app-sidebar__profile-name">{displayName}</div>
              <div className="app-sidebar__profile-role">{roleLabel}</div>
            </div>
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
    </div>
  );
}
