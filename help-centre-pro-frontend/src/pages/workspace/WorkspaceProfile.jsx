import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
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
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  generateCallNumber,
  generateWidgetApiKey,
  getWorkspaceProfile,
  updateCallingSettings,
  updateWorkspaceProfile,
} from "../../api/workspace.api.js";
import PremiumSelect from "../../components/auth/PremiumSelect.jsx";
import { Link } from "react-router-dom";
import { TIMEZONES } from "../../constants/profileOptions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/app.css";
import "../../styles/auth.css";
import "../../styles/admin.css";
import "../../styles/workspace.css";
import "../../styles/settings-premium.css";

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

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

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

function readDefaultPriority(profile) {
  return (
    profile?.defaultTicketPriority ||
    profile?.settings?.defaultTicketPriority ||
    "medium"
  );
}

function readInactivityMinutes(profile) {
  const raw =
    profile?.ticketInactivityMinutes ??
    profile?.settings?.tickets?.inactivityAutoCloseMinutes;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 4320;
  return Math.min(525600, Math.floor(n));
}

function snapshotOf(profile) {
  return {
    name: profile?.name || "",
    timezone: profile?.timezone || "",
    logoUrl: profile?.logoUrl || "",
    supportEmail: profile?.supportEmail || "",
    defaultTicketPriority: readDefaultPriority(profile),
    ticketInactivityMinutes: readInactivityMinutes(profile),
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
    defaultTicketPriority: "medium",
    ticketInactivityMinutes: 4320,
  });
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [defaultTicketPriority, setDefaultTicketPriority] = useState("medium");
  const [ticketInactivityMinutes, setTicketInactivityMinutes] = useState(4320);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [logoError, setLogoError] = useState("");
  const [banner, setBanner] = useState("");
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [revealedApiKey, setRevealedApiKey] = useState("");
  const [callingBusy, setCallingBusy] = useState(false);
  const [callingMode, setCallingMode] = useState("hcp");
  const [hcpPaused, setHcpPaused] = useState(false);
  const [ownNumber, setOwnNumber] = useState("");
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
      setDefaultTicketPriority(snap.defaultTicketPriority);
      setTicketInactivityMinutes(snap.ticketInactivityMinutes);
      setCallingMode(next?.calling?.mode || "hcp");
      setHcpPaused(Boolean(next?.calling?.hcpPaused));
      setOwnNumber(next?.calling?.ownNumber || "");
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
      supportEmail.trim() !== saved.supportEmail ||
      defaultTicketPriority !== saved.defaultTicketPriority ||
      Number(ticketInactivityMinutes) !== Number(saved.ticketInactivityMinutes),
    [
      name,
      timezone,
      logoUrl,
      supportEmail,
      defaultTicketPriority,
      ticketInactivityMinutes,
      saved,
    ]
  );

  const initials = initialsFrom(name || profile?.name);
  const isDataLogo = logoUrl.startsWith("data:");
  const logoUrlDraft = isDataLogo ? "" : logoUrl;

  function handleDiscard() {
    setName(saved.name);
    setTimezone(saved.timezone);
    setLogoUrl(saved.logoUrl);
    setTicketInactivityMinutes(saved.ticketInactivityMinutes);
    setSupportEmail(saved.supportEmail);
    setDefaultTicketPriority(saved.defaultTicketPriority);
    setLogoError("");
    setBanner("");
    setError("");
  }

  function syncCalling(workspace) {
    if (!workspace) return;
    setProfile(workspace);
    setCallingMode(workspace.calling?.mode || "hcp");
    setHcpPaused(Boolean(workspace.calling?.hcpPaused));
    setOwnNumber(workspace.calling?.ownNumber || "");
  }

  async function handleGenerateNumber() {
    if (!canWrite || callingBusy) return;
    setCallingBusy(true);
    setError("");
    setBanner("");
    try {
      const res = await generateCallNumber();
      syncCalling(res?.data?.workspace || profile);
      setBanner(
        res?.message ||
          "HelpCentre Pro number generated and active for outbound calls."
      );
    } catch (err) {
      setError(err.message || "Unable to generate number");
    } finally {
      setCallingBusy(false);
    }
  }

  async function handleCallingSave(payload, successMessage) {
    if (!canWrite || callingBusy) return;
    setCallingBusy(true);
    setError("");
    setBanner("");
    try {
      const res = await updateCallingSettings(payload);
      syncCalling(res?.data?.workspace || profile);
      setBanner(res?.message || successMessage);
    } catch (err) {
      setError(err.message || "Unable to update calling settings");
    } finally {
      setCallingBusy(false);
    }
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
    if (defaultTicketPriority !== saved.defaultTicketPriority) {
      payload.defaultTicketPriority = defaultTicketPriority;
    }
    if (
      Number(ticketInactivityMinutes) !== Number(saved.ticketInactivityMinutes)
    ) {
      payload.ticketInactivityMinutes = Math.max(
        0,
        Math.min(525600, Math.floor(Number(ticketInactivityMinutes) || 0))
      );
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
        // If backend ignored priority, keep local choice in the form snapshot.
        if (
          defaultTicketPriority !== saved.defaultTicketPriority &&
          readDefaultPriority(next) === saved.defaultTicketPriority
        ) {
          snap.defaultTicketPriority = defaultTicketPriority;
        }
        setSaved(snap);
        setName(snap.name);
        setTimezone(snap.timezone);
        setLogoUrl(snap.logoUrl);
        setSupportEmail(snap.supportEmail);
        setDefaultTicketPriority(snap.defaultTicketPriority);
        setTicketInactivityMinutes(snap.ticketInactivityMinutes);
      } else {
        setSaved((prev) => ({
          ...prev,
          name: trimmedName || prev.name,
          timezone: trimmedTimezone || prev.timezone,
          supportEmail: supportEmail.trim(),
          defaultTicketPriority,
          ticketInactivityMinutes: Number(ticketInactivityMinutes),
          logoUrl: trimmedLogo,
        }));
      }
      setBanner("Workspace settings saved.");
    } catch (err) {
      // Retry without settings fields if backend rejects unknown keys.
      const status = err?.status;
      const msg = String(err?.message || "");
      const looksLikeUnknownField =
        status === 400 &&
        /defaultTicketPriority|ticketInactivityMinutes|settings|validation|unknown|not allowed/i.test(
          msg
        );

      if (looksLikeUnknownField && (payload.defaultTicketPriority || payload.settings)) {
        const fallback = { ...payload };
        delete fallback.defaultTicketPriority;
        delete fallback.settings;
        if (!Object.keys(fallback).length) {
          setSaved((prev) => ({ ...prev, defaultTicketPriority }));
          setBanner(
            "Profile fields are up to date. Default priority is saved locally until the API accepts it."
          );
          setSaving(false);
          return;
        }
        try {
          const res2 = await updateWorkspaceProfile(fallback);
          const next = res2?.data?.workspace || null;
          if (next) {
            setProfile(next);
            const snap = snapshotOf(next);
            snap.defaultTicketPriority = defaultTicketPriority;
            setSaved(snap);
            setName(snap.name);
            setTimezone(snap.timezone);
            setLogoUrl(snap.logoUrl);
            setSupportEmail(snap.supportEmail);
            setDefaultTicketPriority(defaultTicketPriority);
          }
          setBanner(
            "Workspace settings saved. Default priority kept locally until the API accepts it."
          );
          setSaving(false);
          return;
        } catch (err2) {
          setError(err2.message || "Failed to save workspace settings");
          setSaving(false);
          return;
        }
      }
      setError(err.message || "Failed to save workspace settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-card" role="status">
        <Loader2 className="settings-spin" size={18} /> Loading workspace settings…
      </div>
    );
  }

  return (
    <div className="settings-stack">
      {banner ? (
        <p className="settings-banner" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {banner}
        </p>
      ) : null}

      {error ? (
        <p className="settings-alert" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {!canWrite ? (
        <p className="settings-note" role="note">
          <ShieldCheck size={16} aria-hidden="true" />
          You can review these settings, but only a tenant admin can change them.
        </p>
      ) : null}

      <section className="settings-card settings-card--form">
        <form className="settings-form" onSubmit={handleSubmit} noValidate>
          <div className="settings-field">
            <label htmlFor="workspace-name">Workspace name</label>
            <input
              id="workspace-name"
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Help Center pro"
              disabled={!canWrite}
              onChange={(event) => setName(event.target.value)}
            />
            {nameError ? (
              <p className="settings-field__error">{nameError}</p>
            ) : null}
          </div>

          <div className="settings-field">
            <label htmlFor="ws-support-email">Support email</label>
            <input
              id="ws-support-email"
              type="email"
              value={supportEmail}
              disabled={!canWrite}
              placeholder="support@helpcenterpro.com"
              onChange={(e) => {
                setSupportEmail(e.target.value);
                setBanner("");
              }}
            />
          </div>

          <div className="settings-form__row">
            <div className="settings-field">
              <label htmlFor="workspace-timezone">Timezone</label>
              <PremiumSelect
                id="workspace-timezone"
                value={timezone}
                onChange={setTimezone}
                options={TIMEZONES}
                placeholder="Select timezone"
                disabled={!canWrite}
              />
            </div>

            <div className="settings-field">
              <label htmlFor="ws-default-priority">Default ticket priority</label>
              <PremiumSelect
                id="ws-default-priority"
                value={defaultTicketPriority}
                onChange={setDefaultTicketPriority}
                options={PRIORITY_OPTIONS}
                placeholder="Medium"
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="settings-field">
            <label htmlFor="ws-inactivity-minutes">
              Ticket inactivity auto-close (minutes)
            </label>
            <input
              id="ws-inactivity-minutes"
              type="number"
              min={0}
              max={525600}
              step={1}
              value={ticketInactivityMinutes}
              disabled={!canWrite}
              onChange={(e) =>
                setTicketInactivityMinutes(
                  Math.max(0, Math.min(525600, Number(e.target.value) || 0))
                )
              }
            />
            <p className="settings-field__hint">
              Open tickets with no activity close after this many minutes. Use{" "}
              <strong>0</strong> to disable. Integrators can read the policy via{" "}
              <code>GET /public/widget/ticket-settings</code>.
            </p>
          </div>

          <div className="settings-form__actions">
            <button
              type="submit"
              className="settings-btn settings-btn--primary"
              disabled={saving || !dirty || Boolean(nameError) || !canWrite}
            >
              {saving ? (
                <Loader2 className="settings-spin" size={16} aria-hidden="true" />
              ) : null}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      <details className="settings-advanced">
        <summary className="settings-advanced__summary">
          Advanced — logo, channels, calling &amp; workspace record
        </summary>

        <div className="workspace-grid" style={{ marginTop: 16 }}>
          <section className="admin-card workspace-card">
            <div className="admin-card__header">
              <h2>Workspace logo</h2>
              <p>PNG, JPG, WEBP, GIF or SVG up to 300KB.</p>
            </div>

            <div className="workspace-logo">
              <div className="workspace-logo__preview" aria-hidden="true">
                {logoUrl ? <img src={logoUrl} alt="" /> : <span>{initials}</span>}
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
                {logoError ? (
                  <p className="workspace-field__error">{logoError}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="admin-card workspace-card">
            <div className="admin-card__header">
              <h2>Channels</h2>
              <p>Connect email and API keys under Configuration / API Token.</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Link
                to="/workspace/settings/configuration"
                className="admin-btn admin-btn--ghost"
                style={{ textDecoration: "none" }}
              >
                <Mail size={14} />
                Configuration
              </Link>
              <Link
                to="/workspace/settings/api-tokens"
                className="admin-btn admin-btn--ghost"
                style={{ textDecoration: "none" }}
              >
                <KeyRound size={14} />
                API tokens
              </Link>
            </div>
          </section>
        </div>

        <section className="admin-card workspace-card" style={{ marginTop: 18 }}>
          <div className="admin-card__header">
            <h2>Calling line</h2>
            <p>
              HelpCentre Pro provides a number customers see when agents call.
            </p>
          </div>

          <div className="workspace-field ws-calling-premium">
            <label>
              <Phone size={14} aria-hidden="true" /> Calling line
              <span className="ws-calling-badge">
                {callingMode === "own"
                  ? "Your number active"
                  : hcpPaused
                    ? "HCP number paused"
                    : "HelpCentre Pro number"}
              </span>
            </label>
            {(profile?.callNumbers || []).length ? (
              <ul className="ws-call-numbers">
                {profile.callNumbers.map((num) => (
                  <li key={num.id || num.e164}>
                    <strong>{num.e164}</strong>
                    {num.label ? ` — ${num.label}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="workspace-field__hint">
                No HCP number yet — generate one below.
              </p>
            )}
            {canWrite ? (
              <div className="ws-calling-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={handleGenerateNumber}
                  disabled={callingBusy}
                >
                  {callingBusy ? (
                    <Loader2 size={14} className="ws-spin" />
                  ) : (
                    <Phone size={14} />
                  )}
                  Generate HCP number
                </button>
                {(profile?.callNumbers || []).length ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    disabled={callingBusy}
                    onClick={() =>
                      handleCallingSave(
                        {
                          mode: hcpPaused ? "hcp" : callingMode,
                          hcpPaused: !hcpPaused,
                        },
                        hcpPaused
                          ? "HelpCentre Pro number resumed."
                          : "HelpCentre Pro number paused."
                      )
                    }
                  >
                    {hcpPaused ? "Resume HCP number" : "Pause HCP number"}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="ws-calling-modes" role="radiogroup" aria-label="Calling line">
              <label className="ws-calling-mode">
                <input
                  type="radio"
                  name="calling-mode"
                  checked={callingMode === "hcp"}
                  onChange={() => setCallingMode("hcp")}
                  disabled={!canWrite}
                />
                <span>
                  <strong>Use HelpCentre Pro number</strong>
                  <small>Customers see your generated HCP line.</small>
                </span>
              </label>
              <label className="ws-calling-mode">
                <input
                  type="radio"
                  name="calling-mode"
                  checked={callingMode === "own"}
                  onChange={() => setCallingMode("own")}
                  disabled={!canWrite}
                />
                <span>
                  <strong>Use my existing number</strong>
                  <small>Pause HCP and call as your own business line.</small>
                </span>
              </label>
            </div>
            {callingMode === "own" ? (
              <div className="ws-calling-own">
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="e.g. +234 803 000 0000"
                  value={ownNumber}
                  onChange={(e) => setOwnNumber(e.target.value)}
                  disabled={!canWrite || callingBusy}
                  aria-label="Your existing business number"
                />
              </div>
            ) : null}
            {canWrite ? (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                style={{ marginTop: 10 }}
                disabled={
                  callingBusy || (callingMode === "own" && !ownNumber.trim())
                }
                onClick={() =>
                  handleCallingSave(
                    {
                      mode: callingMode,
                      hcpPaused: callingMode === "own" ? true : hcpPaused,
                      ownNumber: ownNumber.trim() || null,
                    },
                    callingMode === "own"
                      ? "Your existing number is now the calling line."
                      : "HelpCentre Pro number is now the calling line."
                  )
                }
              >
                {callingBusy ? (
                  <Loader2 size={14} className="ws-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save calling line
              </button>
            ) : null}

            <div className="workspace-field" style={{ marginTop: 16 }}>
              <label>
                <KeyRound size={14} aria-hidden="true" /> Legacy chat widget API key
              </label>
              <p className="workspace-field__hint">
                Prefer Settings → API Token for test/live keys.{" "}
                {profile?.widgetApiKeyPrefix
                  ? `Active key prefix: ${profile.widgetApiKeyPrefix}`
                  : "No legacy key yet."}
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
          </div>
        </section>

        <section
          className="admin-card workspace-card workspace-card--meta"
          style={{ marginTop: 18 }}
        >
          <div className="admin-card__header">
            <h2>Workspace record</h2>
            <p>Managed by Help Center Pro.</p>
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
      </details>
    </div>
  );
}
