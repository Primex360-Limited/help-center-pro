import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Ticket,
  MessageSquare,
  Phone,
  Users,
  BarChart3,
  UserRound,
  FileText,
  Zap,
  Settings,
  Bell,
  Plus,
  Search,
  LogOut,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import SidebarBrand from "./SidebarBrand.jsx";
import "../../styles/app.css";

const PRIMARY_NAV = [
  { to: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard, end: true, ready: true },
  { to: "/tickets", label: "nav.tickets", icon: Ticket, ready: true },
  { to: "/live-chat", label: "Live Chat", icon: MessageSquare, ready: false },
  { to: "/calls", label: "Calls", icon: Phone, ready: false },
  { to: "/customers", label: "Customers", icon: Users, ready: false },
  { to: "/analytics", label: "Analytics", icon: BarChart3, ready: false },
];

const SECONDARY_NAV = [
  { to: "/agents", label: "nav.agents", icon: UserRound, ready: true },
  { to: "/templates", label: "Templates", icon: FileText, ready: false },
  { to: "/automations", label: "Automations", icon: Zap, ready: false },
  { to: "/workspace/profile", label: "nav.settings", icon: Settings, ready: true },
];

function tenantRoleLabel(roleName) {
  if (!roleName) return "Team member";
  if (roleName === "Super Admin") return "Administrator";
  return roleName;
}

function NavItem({ item }) {
  const Icon = item.icon;
  const { t } = useTranslation();
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `app-nav__item${isActive ? " is-active" : ""}`
      }
    >
      <Icon size={18} strokeWidth={1.9} />
      <span>{t(item.label)}</span>
    </NavLink>
  );
}

function ComingSoonNav({ item }) {
  const Icon = item.icon;
  const { t } = useTranslation();
  return (
    <button type="button" className="app-nav__item app-nav__item--soon" disabled>
      <Icon size={18} strokeWidth={1.9} />
      <span>{t(item.label)}</span>
    </button>
  );
}

export default function AppShell() {
  const { user, logout, canManageUsers, canManageSettings } = useAuth();
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
        <div className="app-sidebar__top">
          <SidebarBrand />

          <nav className="app-nav" aria-label="Primary">
            {PRIMARY_NAV.map((item) =>
              item.ready ? (
                <NavItem key={item.to} item={item} />
              ) : (
                <ComingSoonNav key={item.to} item={item} />
              )
            )}
          </nav>

          <nav className="app-nav app-nav--secondary" aria-label="Workspace">
            {SECONDARY_NAV.map((item) => {
              const allowed =
                item.to === "/agents"
                  ? canManageUsers
                  : item.to === "/workspace/profile"
                    ? canManageSettings
                    : true;

              if (item.ready && allowed) {
                return <NavItem key={item.to} item={item} />;
              }
              return <ComingSoonNav key={item.to} item={item} />;
            })}
          </nav>
        </div>

        <div className="app-sidebar__bottom">
          {!howtoDismissed ? (
            <div className="app-howto">
              <div className="app-howto__media" aria-hidden="true">
                <span className="app-howto__play">▶</span>
              </div>
              <div className="app-howto__body">
                <p className="app-howto__title">How it works?</p>
                <a
                  className="app-howto__link"
                  href="https://helpcentrepro.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  What&apos;s new?
                </a>
                <button type="button" className="app-howto__dismiss" onClick={dismissHowto}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

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
            </button>
            <button
              type="button"
              className="app-new-ticket"
              onClick={() => navigate("/tickets/new")}
            >
              <Plus size={16} strokeWidth={2.5} />
              {t("nav.newTicket")}
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
