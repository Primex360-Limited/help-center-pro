import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import { createRole, listRoles, updateRole } from "../../api/roles.api.js";
import { listUsers, updateUser } from "../../api/users.api.js";
import EditMemberModal from "../../components/workspace/EditMemberModal.jsx";
import {
  displayNameOf,
  roleDisplayName,
} from "../../components/workspace/memberUtils.js";
import RoleDialog from "../../components/workspace/RoleDialog.jsx";
import { avatarStyle, initialsOf } from "../../components/workspace/dialogUtils.js";
import {
  TOTAL_ROLE_PERMISSIONS,
  permissionKeysOf,
} from "../../constants/rolePermissions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/app.css";
import "../../styles/user-management.css";

const GROUP_LABEL_BY_PREFIX = {
  ticket: "Tickets",
  message: "Customers",
  note: "Customers",
  template: "Templates",
  agent: "Agent",
  role: "Roles",
  settings: "Settings",
  report: "Reports",
};

function permissionGroupLabel(key) {
  const prefix = String(key || "").split(":")[0];
  return GROUP_LABEL_BY_PREFIX[prefix] || "More access";
}

function joinedDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function normalizeRole(role) {
  return {
    ...role,
    id: role.id || role._id,
    permissions: permissionKeysOf(role),
  };
}

const ROLE_ICON_TONES = ["rose", "teal", "violet", "amber", "blue"];

export default function UserManagement() {
  const { user: currentUser, hasPermission } = useAuth();
  const canEditMembers = hasPermission("agent:update");
  const canManageRoles = hasPermission("role:manage");

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const hasLoadedRef = useRef(false);
  const [banner, setBanner] = useState(null);
  const [savingUserId, setSavingUserId] = useState(null);

  const [editingMember, setEditingMember] = useState(null);
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState("");

  const [roleDialog, setRoleDialog] = useState(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState("");

  const loadData = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    setLoadError("");
    try {
      const [usersRes, rolesRes] = await Promise.all([listUsers(), listRoles()]);
      setUsers(Array.isArray(usersRes?.data?.users) ? usersRes.data.users : []);
      setRoles(
        (Array.isArray(rolesRes?.data?.roles) ? rolesRes.data.roles : [])
          .map(normalizeRole)
          .filter((role) => role.id)
      );
    } catch (err) {
      setLoadError(err.message || "Unable to load users and roles");
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(() => setBanner(null), 4600);
    return () => clearTimeout(timer);
  }, [banner]);

  const members = useMemo(
    () =>
      users.filter(
        (user) =>
          user.userType !== "provider" &&
          !String(user.role?.name || "").includes("Provider")
      ),
    [users]
  );

  const fullAccessCount = useMemo(() => {
    const fullRoleIds = new Set(
      roles
        .filter((role) => role.permissions.length >= TOTAL_ROLE_PERMISSIONS)
        .map((role) => role.id)
    );
    return members.filter((member) =>
      fullRoleIds.has(member.roleId || member.role?.id)
    ).length;
  }, [members, roles]);

  const totalPermissions = useMemo(() => {
    const keys = new Set();
    roles.forEach((role) => role.permissions.forEach((key) => keys.add(key)));
    return Math.max(keys.size, TOTAL_ROLE_PERMISSIONS);
  }, [roles]);

  async function handleAccessChange(member, roleId) {
    if (!roleId || roleId === (member.roleId || member.role?.id)) return;
    setSavingUserId(member.id);
    try {
      await updateUser(member.id, { roleId });
      setBanner({
        tone: "success",
        message: `${displayNameOf(member)} is now ${roleDisplayName(
          roles.find((r) => r.id === roleId)?.name
        )}`,
      });
      await loadData();
    } catch (err) {
      setBanner({ tone: "error", message: err.message || "Unable to change access level" });
    } finally {
      setSavingUserId(null);
    }
  }

  function openMemberEditor(member) {
    setMemberError("");
    setEditingMember(member);
  }

  async function handleSaveMember(patch) {
    if (!editingMember) return;
    setMemberSaving(true);
    setMemberError("");
    try {
      await updateUser(editingMember.id, patch);
      setBanner({ tone: "success", message: `${displayNameOf(editingMember)} updated successfully` });
      setEditingMember(null);
      await loadData();
    } catch (err) {
      setMemberError(err.message || "Unable to update this member");
    } finally {
      setMemberSaving(false);
    }
  }

  function openCreateRole() {
    setRoleError("");
    setRoleDialog({ mode: "create", role: null });
  }

  function openEditRole(role) {
    setRoleError("");
    setRoleDialog({ mode: "edit", role });
  }

  async function handleRoleSubmit(payload) {
    if (!roleDialog) return;
    const isEdit = roleDialog.mode === "edit";
    setRoleSaving(true);
    setRoleError("");
    try {
      if (isEdit) await updateRole(roleDialog.role.id, payload);
      else await createRole(payload);
      setRoleDialog(null);
      setBanner({
        tone: "success",
        message: isEdit ? `"${payload.name}" role updated` : `"${payload.name}" role created`,
      });
      await loadData();
    } catch (err) {
      setRoleError(err.message || `Unable to ${isEdit ? "update" : "create"} this role`);
    } finally {
      setRoleSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="um-page">
        <header className="um-hero">
          <div className="um-hero__copy">
            <span className="um-eyebrow">
              <ShieldCheck size={12} /> Access control
            </span>
            <h1>User Management</h1>
            <p>Loading workspace members and roles…</p>
          </div>
        </header>
        <div className="um-card um-skeleton-card">
          {[0, 1, 2].map((i) => (
            <div className="um-skeleton-row" key={i}>
              <span className="um-skeleton-avatar" />
              <span className="um-skeleton-line" />
              <span className="um-skeleton-line um-skeleton-line--short" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="um-page">
      {banner ? (
        <div className={`um-toast um-toast--${banner.tone}`} role="status">
          {banner.tone === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{banner.message}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <header className="um-hero">
        <div className="um-hero__copy">
          <span className="um-eyebrow">
            <ShieldCheck size={12} /> Access control
          </span>
          <h1>User Management</h1>
          <p>
            {members.length} teammate{members.length === 1 ? "" : "s"} · {fullAccessCount}{" "}
            with full workspace access. Assign an access level and every permission
            outside that role stays locked.
          </p>
        </div>
        <div className="um-hero__actions">
          <button
            type="button"
            className="um-btn um-btn--ghost"
            onClick={loadData}
            title="Refresh members and roles"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            type="button"
            className="um-btn um-btn--primary"
            onClick={openCreateRole}
            disabled={!canManageRoles}
            title={
              canManageRoles
                ? "Create a custom role"
                : "Your role doesn't allow managing roles"
            }
          >
            <Plus size={15} /> New role
          </button>
        </div>
      </header>

      <section className="um-card">
        <div className="um-card__head">
          <div>
            <h2 className="um-card__title">Team members</h2>
            <p className="um-card__sub">
              Access level is the only source of truth — members cannot act beyond
              their role.
            </p>
          </div>
        </div>

        {loadError ? (
          <div className="um-empty">
            <AlertCircle size={22} />
            <h3>We couldn't load your workspace</h3>
            <p>{loadError}</p>
            <button type="button" className="um-btn um-btn--primary" onClick={loadData}>
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="um-empty">
            <h3>No users yet</h3>
            <p>Invite teammates from Agents and they will appear here.</p>
          </div>
        ) : (
          <div className="um-table-wrap">
            <table className="um-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Access level</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf =
                    member.id === currentUser?.id || member.email === currentUser?.email;
                  const currentRoleId = member.roleId || member.role?.id || "";
                  return (
                    <tr key={member.id || member.email}>
                      <td>
                        <button
                          type="button"
                          className="um-user-cell"
                          onClick={() => canEditMembers && openMemberEditor(member)}
                          title={canEditMembers ? `Edit ${displayNameOf(member)}` : displayNameOf(member)}
                        >
                          <span
                            className="um-avatar"
                            style={avatarStyle(member.email || displayNameOf(member))}
                            aria-hidden="true"
                          >
                            {initialsOf(member.firstName, member.lastName)}
                          </span>
                          <span className="um-user-cell__name">
                            {displayNameOf(member)}
                            {isSelf ? <span className="um-you">You</span> : null}
                          </span>
                        </button>
                      </td>
                      <td className="um-email">{member.email}</td>
                      <td>
                        <select
                          className="um-access-select"
                          value={currentRoleId}
                          disabled={!canEditMembers || savingUserId === member.id}
                          onChange={(e) => handleAccessChange(member, e.target.value)}
                          aria-label={`Access level for ${displayNameOf(member)}`}
                        >
                          {!currentRoleId ? <option value="">No access</option> : null}
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {roleDisplayName(role.name)}
                              {role.permissions.length >= TOTAL_ROLE_PERMISSIONS
                                ? " · full access"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="um-joined">{joinedDate(member.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="um-roles-head">
        <div>
          <h2 className="um-section-title">Roles &amp; Permissions</h2>
          <p className="um-subtitle">
            {roles.length} roles · {totalPermissions} permissions in catalog. Modules with
            zero grants stay invisible in the sidebar.
          </p>
        </div>
      </div>

      {roles.length === 0 ? (
        <div className="um-card um-empty">
          <ShieldCheck size={22} />
          <h3>No roles yet</h3>
          <p>Create your first role to control what teammates can do.</p>
          <button type="button" className="um-btn um-btn--primary" onClick={openCreateRole} disabled={!canManageRoles}>
            <Plus size={14} /> New role
          </button>
        </div>
      ) : (
        <div className="um-role-grid">
          {roles.map((role, index) => {
            const groups = [
              ...new Set(role.permissions.map(permissionGroupLabel)),
            ];
            return (
              <article className="um-role-card" key={role.id}>
                <span
                  className={`um-role-card__icon um-role-card__icon--${ROLE_ICON_TONES[index % ROLE_ICON_TONES.length]}`}
                  aria-hidden="true"
                >
                  <ShieldCheck size={17} />
                </span>
                <h3 className="um-role-card__name">{roleDisplayName(role.name)}</h3>
                <p className="um-role-card__desc">
                  {role.description || "Custom role for this workspace."}
                </p>
                <div className="um-role-card__chips">
                  {groups.slice(0, 3).map((label) => (
                    <span className="um-chip" key={label}>
                      <Tag size={10} /> {label}
                    </span>
                  ))}
                  {groups.length > 3 ? (
                    <span className="um-chip um-chip--more">+ more</span>
                  ) : null}
                  {groups.length === 0 ? (
                    <span className="um-chip um-chip--more">No permissions</span>
                  ) : null}
                </div>
                <div className="um-role-card__foot">
                  <span>
                    {role.permissions.length} of {totalPermissions} permissions
                  </span>
                  <button
                    type="button"
                    className="um-edit-link"
                    onClick={() => openEditRole(role)}
                    disabled={!canManageRoles}
                    title={canManageRoles ? `Edit ${roleDisplayName(role.name)}` : "Your role doesn't allow managing roles"}
                  >
                    Edit
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <EditMemberModal
        open={Boolean(editingMember)}
        member={editingMember}
        roles={roles}
        submitting={memberSaving}
        error={memberError}
        onClose={() => !memberSaving && setEditingMember(null)}
        onSubmit={handleSaveMember}
      />

      <RoleDialog
        open={Boolean(roleDialog)}
        mode={roleDialog?.mode || "create"}
        role={roleDialog?.role || null}
        submitting={roleSaving}
        error={roleError}
        onClose={() => !roleSaving && setRoleDialog(null)}
        onSubmit={handleRoleSubmit}
      />
    </div>
  );
}
