import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Edit, Plus, Search, Upload, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  activateTenant,
  deactivateTenant,
  deleteTenant,
  exportTenantsCsv,
  inviteTenant,
  listTenants,
  updateTenant,
} from "../../api/admin.api.js";
import PasswordField from "../../components/auth/PasswordField.jsx";
import PasswordRequirements from "../../components/auth/PasswordRequirements.jsx";
import PremiumSelect from "../../components/auth/PremiumSelect.jsx";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  LANGUAGES,
  TIMEZONES,
} from "../../constants/profileOptions.js";
import { isPasswordValid } from "../../utils/password.js";
import "../../styles/admin.css";
import "../../styles/auth.css";

const MENU_WIDTH = 176;
const MENU_ESTIMATED_HEIGHT = 196;

function workspaceInitial(name = "") {
  return (name.trim()[0] || "W").toUpperCase();
}

function formatLastActive(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

const EMPTY_FORM = {
  workspaceName: "",
  primaryDomain: "",
  website: "",
  plan: "growth",
  country: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  timezone: "Africa/Lagos",
  industry: "Retail & E-commerce",
  language: "en",
  companySize: "",
};

export default function Tenants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editTenant, setEditTenant] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editFormError, setEditFormError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, openUp: false });
  const [actionBusy, setActionBusy] = useState("");
  const menuRef = useRef(null);
  const triggerRefs = useRef({});

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listTenants({ q, status, plan });
      setTenants(result?.data?.tenants || []);
    } catch (err) {
      setError(err.message || "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, [q, status, plan]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const closeMenu = useCallback(() => setMenuFor(null), []);

  const positionMenu = useCallback((tenantId) => {
    const trigger = triggerRefs.current[tenantId];
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < MENU_ESTIMATED_HEIGHT + 12;
    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8
    );
    const top = openUp
      ? Math.max(8, rect.top - MENU_ESTIMATED_HEIGHT - 6)
      : rect.bottom + 6;
    setMenuPos({ top, left, openUp });
  }, []);

  function openActions(tenantId) {
    if (menuFor === tenantId) {
      closeMenu();
      return;
    }
    positionMenu(tenantId);
    setMenuFor(tenantId);
  }

  useEffect(() => {
    if (!menuFor) return undefined;

    function onDocClick(event) {
      const menu = menuRef.current;
      const trigger = triggerRefs.current[menuFor];
      if (menu?.contains(event.target) || trigger?.contains(event.target)) return;
      closeMenu();
    }

    function onReposition() {
      positionMenu(menuFor);
    }

    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [menuFor, closeMenu, positionMenu]);

  const activeMenuTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === menuFor) || null,
    [tenants, menuFor]
  );

  const filteredHint = useMemo(
    () => `${tenants.length} workspace${tenants.length === 1 ? "" : "s"}`,
    [tenants.length]
  );

  function updateField(key) {
    return (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function handleExport() {
    try {
      await exportTenantsCsv({ q, status, plan });
    } catch (err) {
      setError(err.message || "Export failed");
    }
  }

  async function handleInvite(event) {
    event.preventDefault();
    setFormError("");

    if (!form.workspaceName.trim() || form.workspaceName.trim().length < 2) {
      setFormError("Company / workspace name is required");
      return;
    }
    if (!form.timezone || !form.industry || !form.language || !form.companySize) {
      setFormError("Complete language, timezone, industry, and company size before inviting");
      return;
    }
    if (form.password && !isPasswordValid(form.password)) {
      setFormError("Please meet all password requirements");
      return;
    }

    setSubmitting(true);
    try {
      await inviteTenant({
        workspaceName: form.workspaceName.trim(),
        primaryDomain: form.primaryDomain.trim() || undefined,
        website: form.website.trim() || undefined,
        plan: form.plan,
        country: form.country.trim() || undefined,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password || undefined,
        timezone: form.timezone,
        industry: form.industry,
        language: form.language,
        companySize: form.companySize,
      });
      setShowInvite(false);
      setForm(EMPTY_FORM);
      await loadTenants();
    } catch (err) {
      setFormError(err.message || "Unable to send invitation");
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(tenant, action) {
    setActionBusy(`${action}-${tenant.id}`);
    closeMenu();
    try {
      if (action === "activate") await activateTenant(tenant.id);
      if (action === "deactivate") await deactivateTenant(tenant.id);
      if (action === "delete") {
        const ok = window.confirm(
          `Delete workspace "${tenant.name}" permanently? This cannot be undone.`
        );
        if (!ok) return;
        await deleteTenant(tenant.id);
        if (selected?.id === tenant.id) setSelected(null);
      }
      if (action === "edit") {
        setEditTenant(tenant);
        setEditForm({
          name: tenant.name,
          primaryDomain: tenant.primaryDomain || "",
          plan: tenant.plan,
          seatLimit: tenant.seatLimit,
          country: tenant.country || "",
        });
        setEditFormError("");
        setShowEdit(true);
        return;
      }
      await loadTenants();
    } catch (err) {
      setError(err.message || "Action failed");
    } finally {
      setActionBusy("");
    }
  }

  async function handleEdit(event) {
    event.preventDefault();
    setEditFormError("");
    setEditSubmitting(true);
    try {
      await updateTenant(editTenant.id, {
        name: editForm.name.trim(),
        primaryDomain: editForm.primaryDomain.trim() || undefined,
        plan: editForm.plan,
        seatLimit: editForm.seatLimit ? parseInt(editForm.seatLimit, 10) : undefined,
        country: editForm.country.trim() || undefined,
      });
      setShowEdit(false);
      setEditForm({});
      setEditTenant(null);
      await loadTenants();
    } catch (err) {
      setEditFormError(err.message || "Unable to update tenant");
    } finally {
      setEditSubmitting(false);
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title" style={{ marginBottom: 4 }}>
            Tenants
          </h1>
          <p className="admin-kpi__meta">{filteredHint}</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={handleExport}>
            <Upload size={16} />
            Export CVS
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => {
              setFormError("");
              setShowInvite(true);
            }}
          >
            <Plus size={16} />
            New Tenant
          </button>
        </div>
      </div>

      <div className="admin-filters">
        <div className="admin-filters__search">
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              const next = new URLSearchParams(searchParams);
              if (e.target.value) next.set("q", e.target.value);
              else next.delete("q");
              setSearchParams(next, { replace: true });
            }}
            placeholder="Search name or email..."
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="provisioning">Provisioning</option>
          <option value="trial">Trial</option>
        </select>
        <select value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="all">All Plans</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="scale">Scale</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Workspace</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Seats</th>
              <th>MRR</th>
              <th>Tickets/30d</th>
              <th>Last Active</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>
                  <p className="admin-empty">Loading tenants...</p>
                </td>
              </tr>
            ) : tenants.length ? (
              tenants.map((tenant) => (
                <tr key={tenant.id} onClick={() => setSelected(tenant)}>
                  <td>
                    <div className="admin-workspace">
                      <div className="admin-workspace__mark">
                        {workspaceInitial(tenant.name)}
                      </div>
                      <div>
                        <p className="admin-workspace__name">
                          {tenant.primaryDomain || tenant.name}
                        </p>
                        <p className="admin-workspace__meta">
                          {[tenant.admin?.email, tenant.country].filter(Boolean).join(", ") ||
                            tenant.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>{tenant.planLabel}</td>
                  <td>
                    <span className={`admin-status admin-status--${tenant.status}`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td>{tenant.seatsLabel}</td>
                  <td>{money(tenant.mrr)}</td>
                  <td>{Number(tenant.ticketsLast30d || 0).toLocaleString()}</td>
                  <td>{formatLastActive(tenant.lastActiveAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-row-actions__btn"
                        aria-label="Tenant actions"
                        aria-expanded={menuFor === tenant.id}
                        ref={(node) => {
                          if (node) triggerRefs.current[tenant.id] = node;
                          else delete triggerRefs.current[tenant.id];
                        }}
                        onClick={() => openActions(tenant.id)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <p className="admin-empty">No tenants match your filters.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activeMenuTenant
        ? createPortal(
            <div
              ref={menuRef}
              className={`admin-menu admin-menu--portal${menuPos.openUp ? " is-up" : ""}`}
              style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
              role="menu"
            >
              <button
                type="button"
                className="edit"
                role="menuitem"
                disabled={actionBusy.startsWith("edit")}
                onClick={() => runAction(activeMenuTenant, "edit")}
              >
                <Edit size={14} style={{ marginRight: 8 }} />
                Edit
              </button>
              <button
                type="button"
                className="activate"
                role="menuitem"
                disabled={actionBusy.startsWith("activate")}
                onClick={() => runAction(activeMenuTenant, "activate")}
              >
                Activate
              </button>
              <button
                type="button"
                className="deactivate"
                role="menuitem"
                disabled={actionBusy.startsWith("deactivate")}
                onClick={() => runAction(activeMenuTenant, "deactivate")}
              >
                Deactivate
              </button>
              <button
                type="button"
                className="delete"
                role="menuitem"
                disabled={actionBusy.startsWith("delete")}
                onClick={() => runAction(activeMenuTenant, "delete")}
              >
                Delete
              </button>
            </div>,
            document.body
          )
        : null}

      {showInvite ? (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal admin-modal--wide">
            <button
              type="button"
              className="admin-modal__close"
              onClick={() => setShowInvite(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2>Invite a New Tenant</h2>
            <p className="admin-modal__sub">
              Collect the same company details as signup, then send a premium invitation link.
            </p>

            <form className="admin-form" onSubmit={handleInvite}>
              {formError ? <p className="auth-error">{formError}</p> : null}

              <div className="admin-form__row">
                <div>
                  <label htmlFor="tenant-workspace">Company / Workspace Name</label>
                  <input
                    id="tenant-workspace"
                    value={form.workspaceName}
                    onChange={updateField("workspaceName")}
                    placeholder="Your company name"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="tenant-website">Website</label>
                  <input
                    id="tenant-website"
                    value={form.website}
                    onChange={updateField("website")}
                    placeholder="Company.com"
                  />
                </div>
              </div>

              <div className="admin-form__row">
                <div>
                  <label htmlFor="tenant-domain">Primary Domain</label>
                  <input
                    id="tenant-domain"
                    value={form.primaryDomain}
                    onChange={updateField("primaryDomain")}
                    placeholder="primex360.com"
                  />
                </div>
                <div>
                  <label htmlFor="tenant-plan">Plan</label>
                  <select id="tenant-plan" value={form.plan} onChange={updateField("plan")}>
                    <option value="trial">Trial</option>
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="scale">Scale</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="admin-form__row">
                <div>
                  <label htmlFor="tenant-country">Country</label>
                  <input
                    id="tenant-country"
                    value={form.country}
                    onChange={updateField("country")}
                    placeholder="Nigeria"
                  />
                </div>
                <div>
                  <label htmlFor="tenant-email">Admin Email</label>
                  <input
                    id="tenant-email"
                    type="email"
                    value={form.email}
                    onChange={updateField("email")}
                    placeholder="admin@company.com"
                    required
                  />
                </div>
              </div>

              <div className="admin-form__row">
                <div>
                  <label htmlFor="tenant-first">First Name</label>
                  <input
                    id="tenant-first"
                    value={form.firstName}
                    onChange={updateField("firstName")}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="tenant-last">Last Name</label>
                  <input
                    id="tenant-last"
                    value={form.lastName}
                    onChange={updateField("lastName")}
                    required
                  />
                </div>
              </div>

              <PasswordField
                id="tenant-password"
                label="Temporary Password (optional)"
                placeholder="Password"
                value={form.password}
                onChange={updateField("password")}
                autoComplete="new-password"
              />
              {form.password ? <PasswordRequirements password={form.password} /> : null}

              <div className="admin-form__row">
                <div>
                  <label htmlFor="tenant-language">Language</label>
                  <PremiumSelect
                    id="tenant-language"
                    value={form.language}
                    onChange={(value) => setForm((prev) => ({ ...prev, language: value }))}
                    options={LANGUAGES.map((lang) => ({
                      value: lang.code,
                      label: lang.label,
                    }))}
                    placeholder="Select language"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="tenant-timezone">Timezone</label>
                  <PremiumSelect
                    id="tenant-timezone"
                    value={form.timezone}
                    onChange={(value) => setForm((prev) => ({ ...prev, timezone: value }))}
                    options={TIMEZONES}
                    placeholder="Select timezone"
                    required
                  />
                </div>
              </div>

              <div className="admin-form__row">
                <div>
                  <label htmlFor="tenant-industry">Industry</label>
                  <PremiumSelect
                    id="tenant-industry"
                    value={form.industry}
                    onChange={(value) => setForm((prev) => ({ ...prev, industry: value }))}
                    options={INDUSTRIES}
                    placeholder="Select industry"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="tenant-company-size">Company Size</label>
                  <PremiumSelect
                    id="tenant-company-size"
                    value={form.companySize}
                    onChange={(value) => setForm((prev) => ({ ...prev, companySize: value }))}
                    options={COMPANY_SIZES}
                    placeholder="Select company size"
                    required
                  />
                </div>
              </div>

              <div className="admin-form__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setShowInvite(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={submitting}>
                  {submitting ? "Sending Invite..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showEdit ? (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal admin-modal--wide">
            <button
              type="button"
              className="admin-modal__close"
              onClick={() => setShowEdit(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2>Edit Tenant</h2>
            <p className="admin-modal__sub">
              Update workspace information and settings
            </p>

            <form className="admin-form" onSubmit={handleEdit}>
              {editFormError ? <p className="auth-error">{editFormError}</p> : null}

              <div className="admin-form__row">
                <div>
                  <label htmlFor="edit-name">Workspace Name</label>
                  <input
                    id="edit-name"
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Primex360"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="edit-domain">Primary Domain</label>
                  <input
                    id="edit-domain"
                    value={editForm.primaryDomain || ""}
                    onChange={(e) => setEditForm({ ...editForm, primaryDomain: e.target.value })}
                    placeholder="primex360.com"
                  />
                </div>
              </div>

              <div className="admin-form__row">
                <div>
                  <label htmlFor="edit-plan">Plan</label>
                  <select
                    id="edit-plan"
                    value={editForm.plan || "growth"}
                    onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                  >
                    <option value="trial">Trial</option>
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="scale">Scale</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-seatLimit">Seat Limit</label>
                  <input
                    id="edit-seatLimit"
                    type="number"
                    min="1"
                    value={editForm.seatLimit || ""}
                    onChange={(e) => setEditForm({ ...editForm, seatLimit: e.target.value })}
                    placeholder="50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-country">Country</label>
                <input
                  id="edit-country"
                  value={editForm.country || ""}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                  placeholder="Nigeria"
                />
              </div>

              <div className="admin-form__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setShowEdit(false)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal admin-modal--wide">
            <button
              type="button"
              className="admin-modal__close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2>{selected.name}</h2>
            <p className="admin-modal__sub">
              {selected.primaryDomain || selected.slug} · {selected.planLabel}
            </p>

            <div className="admin-detail-grid">
              <div className="admin-detail-item">
                <span>Status</span>
                <strong className={`admin-status admin-status--${selected.status}`}>
                  {selected.status}
                </strong>
              </div>
              <div className="admin-detail-item">
                <span>Plan</span>
                <strong>{selected.planLabel}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Admin</span>
                <strong>{selected.admin?.fullName || "—"}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Admin Email</span>
                <strong>{selected.admin?.email || "—"}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Country</span>
                <strong>{selected.country || "—"}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Seats</span>
                <strong>{selected.seatsLabel}</strong>
              </div>
              <div className="admin-detail-item">
                <span>MRR</span>
                <strong style={{ color: "var(--admin-accent)" }}>{money(selected.mrr)}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Tickets / 30d</span>
                <strong>{Number(selected.ticketsLast30d || 0).toLocaleString()}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Last Active</span>
                <strong>{formatLastActive(selected.lastActiveAt)}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Created</span>
                <strong>
                  {selected.createdAt
                    ? new Date(selected.createdAt).toLocaleString()
                    : "—"}
                </strong>
              </div>
              <div className="admin-detail-item">
                <span>Tenant ID</span>
                <strong style={{ fontSize: 12 }}>{selected.id}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Slug</span>
                <strong>{selected.slug}</strong>
              </div>
            </div>

            <div className="admin-form__actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="admin-btn admin-btn--success"
                onClick={() => runAction(selected, "activate")}
              >
                Activate
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                style={{ color: "#b54708", borderColor: "#fecdca" }}
                onClick={() => runAction(selected, "deactivate")}
              >
                Deactivate
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={() => runAction(selected, "delete")}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
