import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  CreditCard,
  Film,
  Flag,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Search,
  Settings,
  Shield,
  ToggleLeft,
  Users,
  BarChart3,
  ScrollText,
  KeyRound,
  Lock,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminLoginPath } from "../../config/env.js";
import SidebarBrand from "../layout/SidebarBrand.jsx";
import "../../styles/admin.css";

const BUSINESS_NAV = [
  { to: "/admin/overview", label: "Overview", icon: LayoutDashboard, ready: true, end: true },
  { to: "/admin/tenants", label: "Tenants", icon: Building2, ready: true },
  { to: "/admin/billing", label: "Billing", icon: CreditCard, ready: false },
  { to: "/admin/plans", label: "Plans", icon: ToggleLeft, ready: false },
  { to: "/admin/analytics", label: "Platform Analytics", icon: BarChart3, ready: false },
];

const OPERATIONS_NAV = [
  { to: "/admin/staff", label: "Staff and access", icon: Users, ready: false },
  { to: "/admin/sso", label: "Single Sign-on", icon: KeyRound, ready: false },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText, ready: false },
  { to: "/admin/announcements", label: "Announcement", icon: Megaphone, ready: false },
  { to: "/admin/flags", label: "Feature flags", icon: Flag, ready: false },
  { to: "/admin/howto", label: "How it works video", icon: Film, ready: true },
  { to: "/admin/settings", label: "Platform setting", icon: Settings, ready: false },
];

function NavItem({ item }) {
  const Icon = item.icon;
  if (!item.ready) {
    return (
      <button type="button" className="admin-nav__item admin-nav__item--soon" disabled>
        <Icon size={18} strokeWidth={1.9} />
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `admin-nav__item${isActive ? " is-active" : ""}`}
    >
      <Icon size={18} strokeWidth={1.9} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const displayName = useMemo(
    () => [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Admin",
    [user]
  );

  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  async function handleLogout() {
    await logout();
    const path = adminLoginPath();
    if (path.startsWith("http")) {
      window.location.assign(path);
      return;
    }
    navigate(path);
  }

  function handleSearch(event) {
    event.preventDefault();
    const q = search.trim();
    navigate(q ? `/admin/tenants?q=${encodeURIComponent(q)}` : "/admin/tenants");
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <SidebarBrand variant="admin" />
        <div className="admin-sidebar__nav">
          <div>
            <p className="admin-nav-group__label">Business</p>
            <div className="admin-nav-group__items">
              {BUSINESS_NAV.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </div>
          </div>
          <div>
            <p className="admin-nav-group__label">Operations</p>
            <div className="admin-nav-group__items">
              {OPERATIONS_NAV.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </div>
          </div>
        </div>

        <div className="admin-sidebar__footer">
          <div className="admin-user">
            <div className="admin-user__avatar" aria-hidden="true">
              {initials}
            </div>
            <div className="admin-user__copy">
              <div className="admin-user__name">{displayName}</div>
              <div className="admin-user__role">Administrator</div>
            </div>
          </div>
          <button
            type="button"
            className="admin-logout"
            onClick={() => navigate("/change-password")}
            aria-label="Change password"
            title="Change password"
          >
            <Lock size={18} />
          </button>
          <button type="button" className="admin-logout" onClick={handleLogout} aria-label="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <form className="admin-search" onSubmit={handleSearch}>
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Tenants by name, email, or ID..."
            />
          </form>
          <button type="button" className="admin-bell" aria-label="Notifications">
            <Bell size={18} />
            <span className="admin-bell__badge">2</span>
          </button>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
