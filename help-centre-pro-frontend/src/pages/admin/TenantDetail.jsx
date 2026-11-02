import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";
import {
  activateTenant,
  deactivateTenant,
  deleteTenant,
  getTenant,
  updateTenant,
} from "../../api/admin.api.js";
import {
  EmptyBlock,
  ErrorBanner,
  LoadingBlock,
  StatusPill,
  SuccessBanner,
} from "../../components/admin/ui.jsx";
import {
  formatDate,
  formatDateTime,
  formatNaira,
  formatNumber,
  initialOf,
  tileColor,
} from "../../utils/currency.js";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

const PLAN_CHOICES = ["trial", "starter", "growth", "scale", "enterprise"];

export default function TenantDetail() {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getTenant(tenantId);
      setTenant(result?.data?.tenant || null);
    } catch (err) {
      setError(err.message || "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  function openEdit() {
    if (!tenant) return;
    setEdit({
      name: tenant.name || "",
      primaryDomain: tenant.primaryDomain || "",
      plan: tenant.plan || "growth",
      seatLimit: tenant.seatLimit || 5,
      country: tenant.country || "",
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!edit) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateTenant(tenantId, {
        name: edit.name.trim(),
        primaryDomain: edit.primaryDomain.trim() || undefined,
        plan: edit.plan,
        seatLimit: Number(edit.seatLimit) || undefined,
        country: edit.country.trim() || undefined,
      });
      setTenant(result?.data?.tenant || tenant);
      setNotice("Workspace updated.");
      setEdit(null);
    } catch (err) {
      setError(err.message || "Unable to update workspace");
    } finally {
      setSaving(false);
    }
  }

  async function runStatus(action) {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      if (action === "activate") await activateTenant(tenantId);
      if (action === "deactivate") await deactivateTenant(tenantId);
      if (action === "delete") {
        await deleteTenant(tenantId);
        navigate("/admin/tenants");
        return;
      }
      await load();
      setNotice(action === "activate" ? "Workspace activated." : "Workspace deactivated.");
    } catch (err) {
      setError(err.message || "Action failed");
    } finally {
      setBusy("");
      setConfirmDelete(false);
    }
  }

  if (loading && !tenant) {
    return (
      <div className="adm-page">
        <Link className="adm-back" to="/admin/tenants">
          <ArrowLeft size={14} /> All tenants
        </Link>
        <div className="adm-card">
          <LoadingBlock label="Loading workspace…" />
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="adm-page">
        <Link className="adm-back" to="/admin/tenants">
          <ArrowLeft size={14} /> All tenants
        </Link>
        <ErrorBanner message={error || "Workspace not found"} onRetry={load} />
      </div>
    );
  }

  const members = tenant.users || [];

  return (
    <div className="adm-page">
      <Link className="adm-back" to="/admin/tenants">
        <ArrowLeft size={14} /> All tenants
      </Link>

      <ErrorBanner message={error} onRetry={load} />
      <SuccessBanner message={notice} />

      <div className="adm-card adm-detail-hero">
        <div className="adm-detail-hero__id">
          <span
            className="adm-detail-hero__mark"
            style={{ background: tileColor(tenant.name) }}
            aria-hidden="true"
          >
            {initialOf(tenant.name)}
          </span>
          <div>
            <h1>{tenant.name}</h1>
            <p>
              {tenant.primaryDomain || tenant.slug} · {tenant.planLabel} ·{" "}
              <StatusPill status={tenant.trial ? "trial" : tenant.status} />
            </p>
          </div>
        </div>

        <div className="adm-page-actions">
          <button type="button" className="adm-btn adm-btn--light" onClick={openEdit}>
            <Pencil size={13} /> Edit
          </button>
          {tenant.status === "active" ? (
            <button
              type="button"
              className="adm-btn adm-btn--outline"
              disabled={busy === "deactivate"}
              onClick={() => runStatus("deactivate")}
            >
              {busy === "deactivate" ? "Deactivating…" : "Deactivate"}
            </button>
          ) : (
            <button
              type="button"
              className="adm-btn adm-btn--primary"
              disabled={busy === "activate"}
              onClick={() => runStatus("activate")}
            >
              {busy === "activate" ? "Activating…" : "Activate"}
            </button>
          )}
          <button
            type="button"
            className="adm-btn adm-btn--danger"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      <div className="adm-stat-grid">
        <div className="adm-stat">
          <span>MRR</span>
          <strong>{formatNaira(tenant.mrr)}</strong>
        </div>
        <div className="adm-stat">
          <span>Seats</span>
          <strong>{tenant.seatsLabel}</strong>
        </div>
        <div className="adm-stat">
          <span>Tickets / 30d</span>
          <strong>{formatNumber(tenant.ticketsLast30d)}</strong>
        </div>
        <div className="adm-stat">
          <span>Last active</span>
          <strong style={{ fontSize: 12.5 }}>{formatDateTime(tenant.lastActiveAt)}</strong>
        </div>
        <div className="adm-stat">
          <span>Admin</span>
          <strong style={{ fontSize: 12.5 }}>{tenant.admin?.email || "—"}</strong>
        </div>
        <div className="adm-stat">
          <span>Country</span>
          <strong style={{ fontSize: 12.5 }}>{tenant.country || "—"}</strong>
        </div>
        <div className="adm-stat">
          <span>Created</span>
          <strong style={{ fontSize: 12.5 }}>{formatDate(tenant.createdAt)}</strong>
        </div>
        <div className="adm-stat">
          <span>Tenant ID</span>
          <strong style={{ fontSize: 10.5 }}>{tenant.id}</strong>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card__head">
          <h2 className="adm-card__title">Workspace members</h2>
          <span className="adm-count">{formatNumber(members.length)}</span>
        </div>
        {members.length ? (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="is-static">
                  <td>
                    <div className="adm-member">
                      <span className="adm-member__avatar" aria-hidden="true">
                        {initialOf(member.firstName || member.email)}
                      </span>
                      <div>
                        <p className="adm-member__name">
                          {[member.firstName, member.lastName].filter(Boolean).join(" ") ||
                            member.email}
                        </p>
                        <p className="adm-member__email">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="adm-muted">{member.role || "—"}</td>
                  <td>
                    <StatusPill status={member.status} />
                  </td>
                  <td className="adm-muted">{formatDateTime(member.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyBlock title="No members yet" hint="The workspace admin invite is still pending." />
        )}
      </div>

      {edit ? (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <button
              type="button"
              className="admin-modal__close"
              onClick={() => setEdit(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2>Edit workspace</h2>
            <p className="admin-modal__sub">
              Changing the plan updates this workspace&apos;s Naira MRR immediately.
            </p>

            <form className="admin-form" onSubmit={handleSave}>
              <div>
                <label htmlFor="edit-name">Workspace name</label>
                <input
                  id="edit-name"
                  value={edit.name}
                  onChange={(event) => setEdit({ ...edit, name: event.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-domain">Primary domain</label>
                <input
                  id="edit-domain"
                  value={edit.primaryDomain}
                  onChange={(event) => setEdit({ ...edit, primaryDomain: event.target.value })}
                />
              </div>

              <div className="admin-form__row">
                <div>
                  <label htmlFor="edit-plan">Plan</label>
                  <select
                    id="edit-plan"
                    value={edit.plan}
                    onChange={(event) => setEdit({ ...edit, plan: event.target.value })}
                  >
                    {PLAN_CHOICES.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-seats">Seat limit</label>
                  <input
                    id="edit-seats"
                    type="number"
                    min="1"
                    value={edit.seatLimit}
                    onChange={(event) => setEdit({ ...edit, seatLimit: event.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-country">Country</label>
                <input
                  id="edit-country"
                  value={edit.country}
                  onChange={(event) => setEdit({ ...edit, country: event.target.value })}
                />
              </div>

              <div className="admin-form__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setEdit(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <h2>Delete {tenant.name}?</h2>
            <p className="admin-modal__sub">
              This permanently removes the workspace, its members, tickets and settings. This
              cannot be undone.
            </p>
            <div className="admin-form__actions">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={busy === "delete"}
              >
                Cancel
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--danger"
                onClick={() => runStatus("delete")}
                disabled={busy === "delete"}
              >
                {busy === "delete" ? "Deleting…" : "Delete workspace"}
              </button>
            </div>
          </div>
        </div>
      ) : null}


    </div>
  );
}
