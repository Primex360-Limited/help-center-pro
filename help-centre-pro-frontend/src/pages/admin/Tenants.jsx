import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Plus, Search, Upload, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  activateTenant,
  deactivateTenant,
  deleteTenant,
  exportTenantsCsv,
  inviteTenant,
  listTenants,
} from "../../api/admin.api.js";
import PasswordField from "../../components/auth/PasswordField.jsx";
import PasswordRequirements from "../../components/auth/PasswordRequirements.jsx";
import { isPasswordValid } from "../../utils/password.js";
import "../../styles/admin.css";
import "../../styles/auth.css";

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
  plan: "growth",
  country: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
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
  const [menuFor, setMenuFor] = useState(null);
  const [actionBusy, setActionBusy] = useState("");
  const menuRef = useRef(null);

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

  useEffect(() => {
    function onDocClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuFor(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

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

    if (form.password && !isPasswordValid(form.password)) {
      setFormError("Please meet all password requirements");
      return;
    }

    setSubmitting(true);
    try {
      await inviteTenant({
        workspaceName: form.workspaceName.trim(),
        primaryDomain: form.primaryDomain.trim() || undefined,
        plan: form.plan,
        country: form.country.trim() || undefined,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password || undefined,
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
    setMenuFor(null);
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
      await loadTenants();
    } catch (err) {
      setError(err.message || "Action failed");
    } finally {
      setActionBusy("");
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
                    <div className="admin-row-actions" ref={menuFor === tenant.id ? menuRef : null}>
                      <button
                        type="button"
                        className="admin-row-actions__btn"
                        aria-label="Tenant actions"
                        onClick={() =>
                          setMenuFor((current) => (current === tenant.id ? null : tenant.id))
                        }
                      >
                        <ChevronRight size={18} />
                      </button>
                      {menuFor === tenant.id ? (
                        <div className="admin-menu">
                          <button
                            type="button"
                            className="activate"
                            disabled={actionBusy.startsWith("activate")}
                            onClick={() => runAction(tenant, "activate")}
                          >
                            Activate
                          </button>
                          <button
                            type="button"
                            className="deactivate"
                            disabled={actionBusy.startsWith("deactivate")}
                            onClick={() => runAction(tenant, "deactivate")}
                          >
                            Deactivate
                          </button>
                          <button
                            type="button"
                            className="delete"
                            disabled={actionBusy.startsWith("delete")}
                            onClick={() => runAction(tenant, "delete")}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
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
            <h2>Add a New Tenant</h2>
            <p className="admin-modal__sub">
              Create a workspace and send a premium invitation link to the tenant admin.
            </p>

            <form className="admin-form" onSubmit={handleInvite}>
              {formError ? <p className="auth-error">{formError}</p> : null}

              <div className="admin-form__row">
                <div>
                  <label htmlFor="tenant-workspace">Workspace Name</label>
                  <input
                    id="tenant-workspace"
                    value={form.workspaceName}
                    onChange={updateField("workspaceName")}
                    placeholder="Primex360"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="tenant-domain">Primary Domain</label>
                  <input
                    id="tenant-domain"
                    value={form.primaryDomain}
                    onChange={updateField("primaryDomain")}
                    placeholder="primex360.com"
                  />
                </div>
              </div>

              <div className="admin-form__row">
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
                <div>
                  <label htmlFor="tenant-country">Country</label>
                  <input
                    id="tenant-country"
                    value={form.country}
                    onChange={updateField("country")}
                    placeholder="Nigeria"
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

              <div>
                <label htmlFor="tenant-email">Email Address</label>
                <input
                  id="tenant-email"
                  type="email"
                  value={form.email}
                  onChange={updateField("email")}
                  placeholder="admin@company.com"
                  required
                />
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
                  {submitting ? "Sending Invite..." : "Invite Link"}
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
