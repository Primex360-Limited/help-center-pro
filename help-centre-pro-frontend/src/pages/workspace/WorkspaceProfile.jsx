import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Globe2,
  Hash,
  KeyRound,
  Link2,
  Loader2,
  Mail,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  generateWidgetApiKey,
  getWorkspaceProfile,
  updateWorkspaceProfile,
} from "../../api/workspace.api.js";
import PremiumSelect from "../../components/auth/PremiumSelect.jsx";
import { TIMEZONES } from "../../constants/profileOptions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/app.css";
import "../../styles/auth.css";
import "../../styles/admin.css";
import "../../styles/workspace.css";

/** Mirrors the backend `workspace.validation.js` limits. */
const MAX_LOGO_BYTES = 300 * 1024;
const MAX_LOGO_DATA_URL_LENGTH = 400000;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;

const ACCEPTED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

const STATUS_LABELS = {
  active: "Active",
  provisioning: "Provisioning",
  suspended: "Suspended",
  inactive: "Inactive",
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(new Error("That image could not be read. Please try another file."));
    reader.readAsDataURL(file);
  });
}

function isValidHttpsUrl(value) {
  return /^https:\/\/[^\s]+$/i.test(value);
}

function isValidDataUrl(value) {
  const pattern =
    /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[a-z0-9+/=\s]+$/i;
  return pattern.test(value);
}

function initialsFrom(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "WS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function snapshotOf(profile) {
  return {
    name: profile?.name || "",
    timezone: profile?.timezone || "",
    logoUrl: profile?.logoUrl || "",
    supportEmail: profile?.supportEmail || "",
  };
}

export default function WorkspaceProfile() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("settings:write");

  const [profile, setProfile] = useState(null);
  const [saved, setSaved] = useState({
    name: "",
    timezone: "",
    logoUrl: "",
    supportEmail: "",
  });
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [logoError, setLogoError] = useState("");
  const [banner, setBanner] = useState("");
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [revealedApiKey, setRevealedApiKey] = useState("");
  const fileRef = useRef(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getWorkspaceProfile();
      const next = res?.data?.workspace || null;
      setProfile(next);
      const snap = snapshotOf(next);
      setSaved(snap);
      setName(snap.name);
      setTimezone(snap.timezone);
      setLogoUrl(snap.logoUrl);
      setSupportEmail(snap.supportEmail);
    } catch (err) {
      setError(err.message || "Failed to load workspace settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const nameError = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return "Workspace name is required";
    if (trimmed.length < MIN_NAME_LENGTH) {
      return `Workspace name must be at least ${MIN_NAME_LENGTH} characters`;
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return `Workspace name must be ${MAX_NAME_LENGTH} characters or fewer`;
    }
    return "";
  }, [name]);

  const dirty = useMemo(
    () =>
      name.trim() !== saved.name ||
      timezone.trim() !== saved.timezone ||
      logoUrl.trim() !== saved.logoUrl ||
      supportEmail.trim() !== saved.supportEmail,
    [name, timezone, logoUrl, supportEmail, saved]
  );

  const initials = initialsFrom(name || profile?.name);
  const isDataLogo = logoUrl.startsWith("data:");
  const logoUrlDraft = isDataLogo ? "" : logoUrl;

  function handleDiscard() {
    setName(saved.name);
    setTimezone(saved.timezone);
    setLogoUrl(saved.logoUrl);
    setSupportEmail(saved.supportEmail);
    setLogoError("");
    setBanner("");
    setError("");
  }

  async function handleGenerateApiKey() {
    if (!canWrite || apiKeyBusy) return;
    setApiKeyBusy(true);
    setError("");
    setBanner("");
    setRevealedApiKey("");
    try {
      const res = await generateWidgetApiKey();
      const key = res?.data?.apiKey || "";
      setRevealedApiKey(key);
      setBanner(
        res?.message ||
          "API key generated. Copy it now — it will not be shown again."
      );
      if (res?.data?.workspace) {
        setProfile(res.data.workspace);
      }
    } catch (err) {
      setError(err.message || "Unable to generate API key");
    } finally {
      setApiKeyBusy(false);
    }
  }

  async function handleLogoPick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setLogoError("");
    setBanner("");

    const type = String(file.type || "").toLowerCase();
    if (!ACCEPTED_LOGO_TYPES.includes(type)) {
      setLogoError("Use a PNG, JPG, WEBP, GIF or SVG image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo must be 300KB or smaller.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl.length > MAX_LOGO_DATA_URL_LENGTH) {
        setLogoError("Logo is too large once encoded. Please pick a smaller file.");
        return;
      }
      setLogoUrl(dataUrl);
    } catch (err) {
      setLogoError(err.message || "That image could not be read.");
    }
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if (!canWrite || saving) return;

    setBanner("");
    setError("");
    setLogoError("");

    if (nameError) {
      setError(nameError);
      return;
    }

    const trimmedLogo = logoUrl.trim();
    if (
      trimmedLogo &&
      !isValidDataUrl(trimmedLogo) &&
      !isValidHttpsUrl(trimmedLogo)
    ) {
      setLogoError("Logo must be an uploaded image or a public https URL.");
      return;
    }

    const payload = {};
    const trimmedName = name.trim();
    const trimmedTimezone = timezone.trim();

    if (trimmedName !== saved.name) payload.name = trimmedName;
    if (trimmedTimezone !== saved.timezone) payload.timezone = trimmedTimezone;
    if (trimmedLogo !== saved.logoUrl) payload.logoUrl = trimmedLogo;
    if (supportEmail.trim() !== saved.supportEmail) {
      payload.supportEmail = supportEmail.trim();
    }

    if (!Object.keys(payload).length) {
      setBanner("Everything is already up to date.");
      return;
    }

    setSaving(true);
    try {
      const res = await updateWorkspaceProfile(payload);
      const next = res?.data?.workspace || null;
      if (next) {
        setProfile(next);
        const snap = snapshotOf(next);
        setSaved(snap);
        setName(snap.name);
        setTimezone(snap.timezone);
        setLogoUrl(snap.logoUrl);
        setSupportEmail(snap.supportEmail);
      }
      setBanner("Workspace settings saved.");
    } catch (err) {
      setError(err.message || "Failed to save workspace settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="workspace-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title" style={{ marginBottom: 4 }}>
              Workspace Settings
            </h1>
            <p className="admin-kpi__meta">Loading your organisation profile...</p>
          </div>
        </div>
        <div className="admin-card workspace-card workspace-card--loading" role="status">
          <Loader2 className="workspace-spin" size={20} aria-hidden="true" />
          Loading workspace settings...
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title" style={{ marginBottom: 4 }}>
            Workspace Settings
          </h1>
          <p className="admin-kpi__meta">
            Manage your organisation profile, brand logo and default timezone
          </p>
        </div>
        <div className="admin-page-actions">
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={handleDiscard}
            disabled={!dirty || saving}
          >
            <RotateCcw size={16} />
            Discard
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={handleSubmit}
            disabled={saving || !dirty || Boolean(nameError) || !canWrite}
            title={
              canWrite
                ? "Save organisation profile changes"
                : "You need settings write access to save changes"
            }
          >
            {saving ? (
              <Loader2 className="workspace-spin" size={16} aria-hidden="true" />
            ) : (
              <Save size={16} />
            )}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {banner ? (
        <p className="workspace-banner" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {banner}
        </p>
      ) : null}

      {error ? (
        <p className="workspace-alert" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {!canWrite ? (
        <p className="workspace-note" role="note">
          <ShieldCheck size={16} aria-hidden="true" />
          You can review these settings, but only a tenant admin can change them.
        </p>
      ) : null}


      <div className="workspace-grid">
        <section className="admin-card workspace-card">
          <div className="admin-card__header">
            <h2>Organisation profile</h2>
            <p>Shown to your team and on outbound support emails.</p>
          </div>

          <form className="workspace-form" onSubmit={handleSubmit} noValidate>
            <div className="workspace-field">
              <label htmlFor="workspace-name">Workspace name</label>
              <div
                className={`workspace-input${nameError ? " has-error" : ""}`}
              >
                <Building2 size={16} aria-hidden="true" />
                <input
                  id="workspace-name"
                  type="text"
                  value={name}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder="Acme Support"
                  disabled={!canWrite}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              {nameError ? (
                <p className="workspace-field__error">{nameError}</p>
              ) : (
                <p className="workspace-field__hint">
                  {MIN_NAME_LENGTH}-{MAX_NAME_LENGTH} characters. Team members
                  see this name across the workspace.
                </p>
              )}
            </div>

            <div className="workspace-field">
              <label htmlFor="workspace-timezone">Default timezone</label>
              <PremiumSelect
                id="workspace-timezone"
                value={timezone}
                onChange={setTimezone}
                options={TIMEZONES}
                placeholder="Select timezone"
                disabled={!canWrite}
              />
              <p className="workspace-field__hint">
                Used for SLA timers, reporting windows and invitation expiry
                notices.
              </p>
            </div>
          </form>
        </section>

        <section className="admin-card workspace-card">
          <div className="admin-card__header">
            <h2>Workspace logo</h2>
            <p>PNG, JPG, WEBP, GIF or SVG up to 300KB.</p>
          </div>

          <div className="workspace-logo">
            <div className="workspace-logo__preview" aria-hidden="true">
              {logoUrl ? (
                <img src={logoUrl} alt="" />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div className="workspace-logo__body">
              <div className="workspace-logo__actions">
                <input
                  ref={fileRef}
                  type="file"
                  className="workspace-logo__file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  onChange={handleLogoPick}
                  disabled={!canWrite}
                  tabIndex={-1}
                />
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={!canWrite}
                >
                  <Upload size={16} />
                  Upload image
                </button>
                {logoUrl ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost workspace-logo__remove"
                    onClick={() => {
                      setLogoUrl("");
                      setLogoError("");
                      setBanner("");
                    }}
                    disabled={!canWrite}
                  >
                    <Trash2 size={16} />
                    Remove logo
                  </button>
                ) : null}
              </div>

              <div className="workspace-logo__url">
                <Link2 size={16} aria-hidden="true" />
                <input
                  type="url"
                  value={logoUrlDraft}
                  placeholder="https://cdn.example.com/logo.svg"
                  disabled={!canWrite || isDataLogo}
                  onChange={(event) => {
                    setLogoError("");
                    setBanner("");
                    setLogoUrl(event.target.value);
                  }}
                />
              </div>
              <p className="workspace-field__hint">
                {isDataLogo
                  ? "An uploaded image is in use. Remove it to link a hosted https logo instead."
                  : "Or paste a public https image URL. Uploading a file replaces the URL."}
              </p>

              {logoError ? (
                <p className="workspace-field__error">{logoError}</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>


      <section className="admin-card workspace-card">
        <div className="admin-card__header">
          <h2>Channels &amp; integrations</h2>
          <p>
            Connect your mailbox for outbound email. Help Centre Pro provisions
            call numbers. Generate an API key for your in-app chat widget so
            customer details sync into tickets.
          </p>
        </div>

        <div className="workspace-field" style={{ marginBottom: 18 }}>
          <label htmlFor="ws-support-email">
            <Mail size={14} aria-hidden="true" /> Connected support email
          </label>
          <input
            id="ws-support-email"
            type="email"
            value={supportEmail}
            disabled={!canWrite}
            placeholder="support@yourcompany.com"
            onChange={(e) => {
              setSupportEmail(e.target.value);
              setBanner("");
            }}
          />
          <p className="workspace-field__hint">
            Agents send email tickets from this address via Help Centre Pro.
          </p>
        </div>

        <div className="workspace-field" style={{ marginBottom: 18 }}>
          <label>
            <Phone size={14} aria-hidden="true" /> Provisioned call numbers
          </label>
          {(profile?.callNumbers || []).length ? (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {profile.callNumbers.map((num) => (
                <li key={num.id || num.e164}>
                  <strong>{num.e164}</strong>
                  {num.label ? ` — ${num.label}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="workspace-field__hint">
              No numbers yet. Help Centre Pro assigns lines to your workspace.
            </p>
          )}
        </div>

        <div className="workspace-field">
          <label>
            <KeyRound size={14} aria-hidden="true" /> Chat widget API key
          </label>
          <p className="workspace-field__hint">
            {profile?.widgetApiKeyPrefix
              ? `Active key prefix: ${profile.widgetApiKeyPrefix}`
              : "No key yet. Generate one to embed in your app chat."}
          </p>
          {revealedApiKey ? (
            <p
              className="agents-banner"
              role="status"
              style={{ wordBreak: "break-all", marginTop: 8 }}
            >
              {revealedApiKey}
            </p>
          ) : null}
          {canWrite ? (
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              style={{ marginTop: 10 }}
              disabled={apiKeyBusy}
              onClick={handleGenerateApiKey}
            >
              <KeyRound size={16} />
              {apiKeyBusy ? "Generating…" : "Generate API key"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="admin-card workspace-card workspace-card--meta">
        <div className="admin-card__header">
          <h2>Workspace record</h2>
          <p>Managed by Help Center Pro. Contact support to change your plan.</p>
        </div>

        <div className="workspace-meta">
          <div className="workspace-meta__item">
            <span className="workspace-meta__icon" aria-hidden="true">
              <Hash size={16} />
            </span>
            <div>
              <span>Workspace slug</span>
              <strong>{profile?.slug || "—"}</strong>
            </div>
          </div>

          <div className="workspace-meta__item">
            <span className="workspace-meta__icon" aria-hidden="true">
              <Globe2 size={16} />
            </span>
            <div>
              <span>Primary domain</span>
              <strong>{profile?.primaryDomain || "Not connected"}</strong>
            </div>
          </div>

          <div className="workspace-meta__item">
            <span className="workspace-meta__icon" aria-hidden="true">
              <ShieldCheck size={16} />
            </span>
            <div>
              <span>Status</span>
              <strong>
                {STATUS_LABELS[String(profile?.status || "").toLowerCase()] ||
                  profile?.status ||
                  "—"}
              </strong>
            </div>
          </div>

          <div className="workspace-meta__item">
            <span className="workspace-meta__icon" aria-hidden="true">
              <CreditCard size={16} />
            </span>
            <div>
              <span>Plan</span>
              <strong>{profile?.plan || "—"}</strong>
            </div>
          </div>

          <div className="workspace-meta__item">
            <span className="workspace-meta__icon" aria-hidden="true">
              <Users size={16} />
            </span>
            <div>
              <span>Seat limit</span>
              <strong>
                {profile?.seatLimit === null || profile?.seatLimit === undefined
                  ? "Unlimited"
                  : profile.seatLimit}
              </strong>
            </div>
          </div>

          <div className="workspace-meta__item">
            <span className="workspace-meta__icon" aria-hidden="true">
              <CalendarDays size={16} />
            </span>
            <div>
              <span>Workspace created</span>
              <strong>{formatDate(profile?.createdAt)}</strong>
            </div>
          </div>
        </div>
      </section>

      <footer className="workspace-footer">
        <p>
          Invitations from the Agents screen stay active for 48 hours and can be
          used once. Timezone changes apply to new activity only.
        </p>
      </footer>
    </div>
  );
}

