import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Building2,
  CreditCard,
  Film,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Search,
  Settings,
  ToggleLeft,
  Users,
  BarChart3,
  ScrollText,
  Lock,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminLoginPath } from "../../config/env.js";
import { getPlatformOverview } from "../../api/admin.api.js";
import SidebarBrand from "../layout/SidebarBrand.jsx";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

const BUSINESS_NAV = [
  { to: "/admin/overview", label: "Overview", icon: LayoutDashboard, ready: true, end: true },
  { to: "/admin/tenants", label: "Tenants", icon: Building2, ready: true },
  { to: "/admin/billing", label: "Billing", icon: CreditCard, ready: true },
  { to: "/admin/plans", label: "Plans", icon: ToggleLeft, ready: true },
  { to: "/admin/analytics", label: "Platform Analytics", icon: BarChart3, ready: true },
];

const OPERATIONS_NAV = [
  { to: "/admin/staff", label: "Staff and access", icon: Users, ready: true },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText, ready: true },
  { to: "/admin/announcements", label: "Announcement", icon: Megaphone, ready: true },
  { to: "/admin/howto", label: "How it works video", icon: Film, ready: true },
  { to: "/admin/settings", label: "Platform setting", icon: Settings, ready: true },
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
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [pastDue, setPastDue] = useState(0);

  // Real notification count: invoices the platform has not collected yet.
  useEffect(() => {
    let cancelled = false;
    getPlatformOverview()
      .then((result) => {
        if (cancelled) return;
        const metrics = result?.data?.overview?.metrics || {};
        setPastDue(Number(metrics.pastDueInvoices) || 0);
      })
      .catch(() => {
        /* the bell is decorative if the metrics call fails */
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

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

  const handleBell = useCallback(() => {
    navigate(pastDue > 0 ? "/admin/billing?status=past_due" : "/admin/billing");
  }, [navigate, pastDue]);

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
          <button
            type="button"
            className="admin-bell"
            aria-label={
              pastDue > 0
                ? `${pastDue} past-due invoice${pastDue === 1 ? "" : "s"}`
                : "Notifications"
            }
            title={pastDue > 0 ? `${pastDue} past-due invoice${pastDue === 1 ? "" : "s"}` : "No billing alerts"}
            onClick={handleBell}
          >
            <Bell size={18} />
            {pastDue > 0 ? (
              <span className="admin-bell__badge">{pastDue > 9 ? "9+" : pastDue}</span>
            ) : null}
          </button>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
