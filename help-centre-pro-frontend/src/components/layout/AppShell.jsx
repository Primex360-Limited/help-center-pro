import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { APP_NAME } from "../../config/env.js";
import brandMark from "../../assets/helpcentre-pro-logo-light.png";
import "../../styles/app.css";

export default function AppShell() {
  const { user, logout, canManageUsers } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <img
            className="app-sidebar__logo"
            src={brandMark}
            alt={APP_NAME}
            draggable="false"
          />
        </div>
        <nav className="app-nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          {canManageUsers ? <NavLink to="/agents">Team & Agents</NavLink> : null}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <h1>Workspace</h1>
          <div className="app-user">
            <div className="app-user__meta">
              <div className="app-user__name">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="app-user__role">
                {user?.roleName || "Team member"}
              </div>
            </div>
            <button type="button" onClick={handleLogout}>
              Logout
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
