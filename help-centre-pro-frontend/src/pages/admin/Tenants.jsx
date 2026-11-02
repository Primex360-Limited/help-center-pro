import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Download, Plus, Search, X } from "lucide-react";
import { exportTenantsCsv, inviteTenant, listTenants } from "../../api/admin.api.js";
import PasswordField from "../../components/auth/PasswordField.jsx";
import PasswordRequirements from "../../components/auth/PasswordRequirements.jsx";
import {
  EmptyBlock,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  RowChevron,
  StatusPill,
  SuccessBanner,
} from "../../components/admin/ui.jsx";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  LANGUAGES,
  TIMEZONES,
} from "../../constants/profileOptions.js";
import {
  formatDateTimeShort,
  formatNaira,
  formatNumber,
  initialOf,
  tileColor,
} from "../../utils/currency.js";
import { isPasswordValid } from "../../utils/password.js";
import "../../styles/admin.css";
import "../../styles/auth.css";
import "../../styles/admin-platform.css";

const STATUS_FILTERS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "provisioning", label: "Provisioning" },
  { value: "suspended", label: "Suspended" },
];

const PLAN_FILTERS = [
  { value: "all", label: "All Plans" },
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "scale", label: "Scale" },
  { value: "enterprise", label: "Enterprise" },
  { value: "trial", label: "Trial" },
];

const EMPTY_FORM = {
  workspaceName: "",
  primaryDomain: "",
  website: "",
  plan: "growth",
  country: "Nigeria",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  timezone: "Africa/Lagos",
  industry: "Retail & E-commerce",
  language: "en",
  companySize: "11-50 employees",
};

export default function Tenants() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");

  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listTenants();
      setTenants(result?.data?.tenants || []);
    } catch (err) {
      setError(err.message || "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the top-bar search (`?q=`) in sync with the local filter box.
  useEffect(() => {
    const incoming = searchParams.get("q") || "";
    setQ((current) => (current === incoming ? current : incoming));
  }, [searchParams]);

  function onSearchChange(event) {
    const value = event.target.value;
    setQ(value);
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return tenants.filter((tenant) => {
      if (status === "trial" && !tenant.trial) return false;
      if (status !== "all" && status !== "trial" && tenant.status !== status) return false;
      if (plan !== "all" && tenant.plan !== plan) return false;
      if (!query) return true;
      return [tenant.name, tenant.slug, tenant.primaryDomain, tenant.admin?.email, tenant.country]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [tenants, q, status, plan]);

  async function handleExport() {
    setExporting(true);
    setError("");
    setNotice("");
    try {
      await exportTenantsCsv({ q, status, plan });
      setNotice(
        `Exported ${filtered.length} workspace${filtered.length === 1 ? "" : "s"} as CSV.`
      );
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function openInvite() {
    setForm(EMPTY_FORM);
    setFormError("");
    setShowInvite(true);
  }

  function updateField(key) {
    return (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function handleInvite(event) {
    event.preventDefault();
    setFormError("");

    if (form.workspaceName.trim().length < 2) {
      setFormError("Company / workspace name is required");
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError("Admin first and last name are required");
      return;
    }
    if (!form.email.includes("@")) {
      setFormError("A valid admin email is required");
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
      setNotice(`${form.workspaceName.trim()} was provisioned and the admin invite was sent.`);
      await load();
    } catch (err) {
      setFormError(err.message || "Unable to invite tenant");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="adm-page">
      <PageHeader title="Tenants">
        <button
          type="button"
          className="adm-btn adm-btn--light"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download size={14} />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
        <button type="button" className="adm-btn adm-btn--primary" onClick={openInvite}>
          <Plus size={14} /> New Tenant
        </button>
      </PageHeader>

      <ErrorBanner message={error} onRetry={load} />
      <SuccessBanner message={notice} />

      <div className="adm-filterbar">
        <div className="adm-search-inline">
          <Search size={15} />
          <input
            value={q}
            onChange={onSearchChange}
            placeholder="Search Tenants by name, email, or ID..."
            aria-label="Search tenants"
          />
        </div>
        <select
          className="adm-select"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="adm-select"
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          aria-label="Filter by plan"
        >
          {PLAN_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="adm-table-card">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Workspace</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Seats</th>
              <th>MRR</th>
              <th>Tickets/30d</th>
              <th>Last Active</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="is-static">
                <td colSpan={8}>
                  <LoadingBlock label="Loading workspaces…" />
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((tenant) => (
                <tr
                  key={tenant.id}
                  onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/admin/tenants/${tenant.id}`);
                    }
                  }}
                >
                  <td>
                    <div className="adm-ws">
                      <span
                        className="adm-ws__mark"
                        style={{ background: tileColor(tenant.name) }}
                        aria-hidden="true"
                      >
                        {initialOf(tenant.name)}
                      </span>
                      <div>
                        <p className="adm-ws__name">{tenant.name}</p>
                        <p className="adm-ws__meta">
                          {[tenant.admin?.email || tenant.primaryDomain || tenant.slug, tenant.country]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>{tenant.planLabel}</td>
                  <td>
                    <StatusPill status={tenant.trial ? "trial" : tenant.status} upper />
                  </td>
                  <td>{tenant.seatsLabel}</td>
                  <td className="adm-strong">{formatNaira(tenant.mrr)}</td>
                  <td>{formatNumber(tenant.ticketsLast30d)}</td>
                  <td className="adm-muted ten-last-active">
                    {formatDateTimeShort(tenant.lastActiveAt)}
                  </td>
                  <td className="adm-chev">
                    <RowChevron />
                  </td>
                </tr>
              ))
            ) : (
              <tr className="is-static">
                <td colSpan={8}>
                  <EmptyBlock
                    title="No tenants match your filters"
                    hint="Try a different status, plan, or search term."
                  />
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
                    placeholder="company.com"
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

              <div className="admin-form__row">
                <div>
                  <label htmlFor="tenant-timezone">Timezone</label>
                  <select
                    id="tenant-timezone"
                    value={form.timezone}
                    onChange={updateField("timezone")}
                  >
                    {TIMEZONES.map((zone) => (
                      <option key={zone.value} value={zone.value}>
                        {zone.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tenant-industry">Industry</label>
                  <select
                    id="tenant-industry"
                    value={form.industry}
                    onChange={updateField("industry")}
                  >
                    {INDUSTRIES.map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-form__row">
                <div>
                  <label htmlFor="tenant-language">Language</label>
                  <select
                    id="tenant-language"
                    value={form.language}
                    onChange={updateField("language")}
                  >
                    {LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tenant-size">Company Size</label>
                  <select
                    id="tenant-size"
                    value={form.companySize}
                    onChange={updateField("companySize")}
                  >
                    {COMPANY_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <PasswordField
                  id="tenant-password"
                  label="Temporary Password (optional)"
                  value={form.password}
                  onChange={updateField("password")}
                  placeholder="Leave blank to auto-generate"
                  autoComplete="new-password"
                />
                {form.password ? <PasswordRequirements password={form.password} /> : null}
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
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={submitting}
                >
                  {submitting ? "Sending invite…" : "Send invite"}
                </button>
              </div>

            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}

