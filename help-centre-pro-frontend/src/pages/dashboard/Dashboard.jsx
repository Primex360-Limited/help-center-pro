import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/app.css";

export default function Dashboard() {
  const { user, canManageUsers, canManageRoles } = useAuth();

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Signed in as</span>
          <strong style={{ fontSize: 18 }}>
            {user?.firstName} {user?.lastName}
          </strong>
        </div>
        <div className="stat-card">
          <span>Role</span>
          <strong style={{ fontSize: 18 }}>{user?.roleName || "—"}</strong>
        </div>
        <div className="stat-card">
          <span>Permissions</span>
          <strong style={{ fontSize: 18 }}>
            {user?.isSuperAdmin ? "Full access" : (user?.permissions || []).length}
          </strong>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2>Authentication & access</h2>
            <p>
              You are authenticated with HelpCentre Pro RBAC. Admins can invite
              and manage agents from Team & Agents.
            </p>
          </div>
        </div>

        <ul style={{ margin: 0, paddingLeft: 18, color: "#475569", lineHeight: 1.7 }}>
          <li>Login / logout with secure JWT sessions</li>
          <li>Password reset and email verification flows</li>
          <li>
            Role-based access: {canManageUsers ? "user management enabled" : "view-only agent access"}
            {canManageRoles ? " · role management enabled" : ""}
          </li>
        </ul>
      </div>
    </div>
  );
}
