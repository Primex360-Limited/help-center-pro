import { useCallback, useEffect, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { getStaff, inviteStaff, updateStaffMember } from "../../api/admin.api.js";
import {
  EmptyBlock,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusPill,
  SuccessBanner,
} from "../../components/admin/ui.jsx";
import { formatDateTime } from "../../utils/currency.js";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

const ROLE_OPTIONS = ["Owner", "Admin", "Support", "Viewer"];

const EMPTY_INVITE = { firstName: "", lastName: "", email: "", role: "Admin" };

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState(EMPTY_INVITE);
  const [inviteError, setInviteError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getStaff();
      setStaff(result?.data?.staff || []);
    } catch (err) {
      setError(err.message || "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const query = q.trim().toLowerCase();
  const filtered = staff.filter((member) =>
    query
      ? [member.fullName, member.email, member.role].join(" ").toLowerCase().includes(query)
      : true
  );

  async function patchMember(member, payload, busyKey) {
    setBusy(busyKey);
    setError("");
    setNotice("");
    try {
      const result = await updateStaffMember(member.id, payload);
      const updated = result?.data?.staff;
      if (updated) {
        setStaff((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      }
      if (payload.status) {
        setNotice(`${member.fullName} ${payload.status === "active" ? "enabled" : "disabled"}.`);
      }
      if (payload.role) {
        setNotice(`${member.fullName} is now a ${payload.role}.`);
      }
    } catch (err) {
      setError(err.message || "Unable to update team member");
    } finally {
      setBusy("");
    }
  }

  async function handleInvite(event) {
    event.preventDefault();
    setInviteError("");
    setTempPassword("");

    if (!invite.firstName.trim() || !invite.lastName.trim()) {
      setInviteError("First and last name are required");
      return;
    }
    if (!invite.email.includes("@")) {
      setInviteError("A valid work email is required");
      return;
    }

    setSaving(true);
    try {
      const result = await inviteStaff({
        firstName: invite.firstName.trim(),
        lastName: invite.lastName.trim(),
        email: invite.email.trim(),
        role: invite.role,
      });
      const payload = result?.data || {};
      if (payload.staff) setStaff((prev) => [...prev, payload.staff]);
      setShowInvite(false);
      setInvite(EMPTY_INVITE);
      setNotice(
        payload.emailSent
          ? `Invitation emailed to ${invite.email.trim()}.`
          : "Teammate created. Share the temporary password below."
      );
      setTempPassword(payload.temporaryPassword || "");
    } catch (err) {
      setInviteError(err.message || "Unable to invite teammate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-page">
      <PageHeader title="Staff and Access">
        <button
          type="button"
          className="adm-btn adm-btn--primary"
          onClick={() => {
            setInvite(EMPTY_INVITE);
            setInviteError("");
            setShowInvite(true);
          }}
        >
          <UserPlus size={14} /> Invite teammate
        </button>
      </PageHeader>

      <ErrorBanner message={error} onRetry={load} />
      <SuccessBanner message={notice} />
      {tempPassword ? (
        <div className="adm-banner adm-banner--success" role="status">
          <span>
            Temporary password: <strong>{tempPassword}</strong> — the teammate must change it at
            first sign-in.
          </span>
        </div>
      ) : null}

      <div className="adm-filterbar">
        <div className="adm-search-inline">
          <Search size={15} />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search team by name, email, or role..."
            aria-label="Search team"
          />
        </div>
      </div>

      <div className="adm-table-card">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Status</th>
              <th>2FA</th>
              <th>Last login</th>
              <th className="adm-action-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="is-static">
                <td colSpan={6}>
                  <LoadingBlock label="Loading team…" />
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((member) => (
                <tr key={member.id} className="is-static">
                  <td>
                    <div className="adm-member">
                      <span className="adm-member__avatar" aria-hidden="true">
                        {member.initials}
                      </span>
                      <div>
                        <p className="adm-member__name">
                          {member.fullName}
                          {member.isSelf ? " (you)" : ""}
                        </p>
                        <p className="adm-member__email">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      className="adm-select adm-select--sm"
                      value={member.role}
                      disabled={busy === `${member.id}:role`}
                      onChange={(event) =>
                        patchMember(member, { role: event.target.value }, `${member.id}:role`)
                      }
                      aria-label={`Role for ${member.fullName}`}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <StatusPill
                      status={
                        member.status === "active"
                          ? "active"
                          : member.status === "invited"
                            ? "invited"
                            : "inactive"
                      }
                    />
                  </td>
                  <td>
                    <span className={`adm-2fa${member.twoFactorEnabled ? "" : " adm-2fa--off"}`}>
                      {member.twoFactorEnabled ? "Enabled" : "Off"}
                    </span>
                  </td>
                  <td className="adm-muted">{formatDateTime(member.lastLoginAt)}</td>
                  <td className="adm-action-cell">
                    <button
                      type="button"
                      className={`adm-btn adm-btn--sm ${
                        member.status === "active" ? "adm-btn--outline" : "adm-btn--primary"
                      }`}
                      disabled={busy === `${member.id}:status` || member.isSelf}
                      onClick={() =>
                        patchMember(
                          member,
                          { status: member.status === "active" ? "inactive" : "active" },
                          `${member.id}:status`
                        )
                      }
                    >
                      {member.status === "active" ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="is-static">
                <td colSpan={6}>
                  <EmptyBlock
                    title="No teammates match your search"
                    hint="Invite a teammate to give them admin access."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showInvite ? (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <button
              type="button"
              className="admin-modal__close"
              onClick={() => setShowInvite(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2>Invite teammate</h2>
            <p className="admin-modal__sub">
              Platform staff sign in to this Admin Portal with a one-time password.
            </p>

            <form className="admin-form" onSubmit={handleInvite}>
              {inviteError ? <p className="auth-error">{inviteError}</p> : null}

              <div className="admin-form__row">
                <div>
                  <label htmlFor="staff-first">First name</label>
                  <input
                    id="staff-first"
                    value={invite.firstName}
                    onChange={(event) =>
                      setInvite((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label htmlFor="staff-last">Last name</label>
                  <input
                    id="staff-last"
                    value={invite.lastName}
                    onChange={(event) =>
                      setInvite((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="staff-email">Work email</label>
                <input
                  id="staff-email"
                  type="email"
                  value={invite.email}
                  onChange={(event) =>
                    setInvite((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="teammate@primex360.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="staff-role">Role</label>
                <select
                  id="staff-role"
                  value={invite.role}
                  onChange={(event) =>
                    setInvite((prev) => ({ ...prev, role: event.target.value }))
                  }
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setShowInvite(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                  {saving ? "Sending…" : "Send invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}
