import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { getWebhookSettings, updateWebhookSettings } from "../../api/settings.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/settings-premium.css";

const EVENT_OPTIONS = [
  {
    key: "ticket.created",
    label: "ticket.created",
    hint: "Fires when a new ticket is logged.",
  },
  {
    key: "ticket.updated",
    label: "ticket.updated",
    hint: "Fires when a ticket changes status or assignee.",
  },
  {
    key: "ticket.resolved",
    label: "ticket.resolved",
    hint: "Fires when a ticket is resolved.",
  },
  {
    key: "customer.created",
    label: "customer.created",
    hint: "Fires when a new customer profile appears.",
  },
];

const EMPTY = {
  endpointUrl: "",
  signingSecret: "",
  hasSigningSecret: false,
  events: {
    "ticket.created": true,
    "ticket.updated": true,
    "ticket.resolved": false,
    "customer.created": false,
  },
};

export default function WebhookSettings() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("settings:write");

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getWebhookSettings();
      const raw = res?.data || res || {};
      const data = raw.webhooks || raw;
      const events = { ...EMPTY.events, ...(data.events || {}) };
      setForm({
        endpointUrl: data.endpointUrl || data.url || "",
        signingSecret: data.signingSecret || data.secret || "",
        hasSigningSecret: Boolean(
          data.hasSigningSecret || data.signingSecret || data.secret
        ),
        events,
      });
    } catch (err) {
      setError(err.message || "Failed to load webhook settings");
      setForm(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleEvent(key) {
    setForm((prev) => ({
      ...prev,
      events: { ...prev.events, [key]: !prev.events[key] },
    }));
  }

  async function copySecret() {
    if (!form.signingSecret) return;
    try {
      await navigator.clipboard.writeText(form.signingSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  async function handleSave(event, { regenerateSecret = false } = {}) {
    event?.preventDefault?.();
    if (!canWrite || saving) return;
    setSaving(true);
    setError("");
    setBanner("");
    try {
      const hasSecret = Boolean(form.signingSecret.trim()) || form.hasSigningSecret;
      const payload = {
        endpointUrl: form.endpointUrl.trim(),
        events: form.events,
        generateSecret: regenerateSecret || !hasSecret,
      };
      if (form.signingSecret.trim() && !regenerateSecret) {
        payload.signingSecret = form.signingSecret.trim();
      }
      const res = await updateWebhookSettings(payload);
      setBanner(res?.message || "Webhook settings saved.");
      const data = res?.data?.webhooks || res?.data || {};
      setForm((prev) => ({
        ...prev,
        endpointUrl: data.endpointUrl || data.url || prev.endpointUrl,
        signingSecret:
          data.signingSecret || data.secret || prev.signingSecret,
        hasSigningSecret: Boolean(
          data.hasSigningSecret ||
            data.signingSecret ||
            data.secret ||
            prev.hasSigningSecret
        ),
        events: { ...prev.events, ...(data.events || {}) },
      }));
      if (regenerateSecret) setShowSecret(true);
    } catch (err) {
      setError(err.message || "Failed to save webhook settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-card" role="status">
        <Loader2 className="settings-spin" size={18} /> Loading webhooks…
      </div>
    );
  }

  return (
    <form
      className="settings-webhook-stack"
      onSubmit={(e) => handleSave(e)}
    >
      {banner ? (
        <p className="settings-banner" role="status">
          <CheckCircle2 size={16} />
          {banner}
        </p>
      ) : null}
      {error ? (
        <p className="settings-alert" role="alert">
          {error}
        </p>
      ) : null}

      <section className="settings-card">
        <div className="settings-form">
          <div className="settings-field">
            <label htmlFor="webhook-url">Endpoint URL</label>
            <input
              id="webhook-url"
              type="url"
              placeholder="http://api.example.com/webhook/helpcenter"
              value={form.endpointUrl}
              disabled={!canWrite}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, endpointUrl: e.target.value }))
              }
            />
            <p className="settings-field__hint">
              We send a POST request with a JSON payload for every selected event.
            </p>
          </div>

          <div className="settings-field">
            <label htmlFor="webhook-secret">Signing secret</label>
            <div className="settings-secret-row">
              <input
                id="webhook-secret"
                type={showSecret ? "text" : "password"}
                placeholder="whsec_…"
                value={form.signingSecret}
                autoComplete="off"
                spellCheck={false}
                disabled={!canWrite}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    signingSecret: e.target.value,
                    hasSigningSecret: Boolean(e.target.value.trim()),
                  }))
                }
              />
              <button
                type="button"
                className="settings-btn settings-btn--secondary settings-btn--icon"
                onClick={() => setShowSecret((v) => !v)}
                disabled={!form.signingSecret}
                aria-label={showSecret ? "Hide signing secret" : "Show signing secret"}
                title={showSecret ? "Hide" : "Show"}
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                className="settings-btn settings-btn--secondary settings-btn--icon"
                onClick={copySecret}
                disabled={!form.signingSecret}
                aria-label="Copy signing secret"
                title="Copy"
              >
                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              </button>
              {canWrite ? (
                <button
                  type="button"
                  className="settings-btn settings-btn--secondary settings-btn--sm"
                  disabled={saving}
                  onClick={(e) => handleSave(e, { regenerateSecret: true })}
                  title="Generate a new signing secret"
                >
                  <RefreshCw size={14} />
                  Rotate
                </button>
              ) : null}
            </div>
            <p className="settings-field__hint">
              Verify deliveries with HMAC-SHA256 of the raw body using header{" "}
              <code>X-HCP-Signature</code>.
            </p>
          </div>
        </div>
      </section>

      <section className="settings-card settings-card--flush">
        <div className="settings-toggle-list">
          {EVENT_OPTIONS.map((opt) => (
            <div className="settings-toggle" key={opt.key}>
              <div className="settings-toggle__label">
                <strong>{opt.label}</strong>
                <span>{opt.hint}</span>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={Boolean(form.events[opt.key])}
                  disabled={!canWrite}
                  onChange={() => toggleEvent(opt.key)}
                />
                <span className="settings-switch__track" />
              </label>
            </div>
          ))}
        </div>
      </section>

      <div className="settings-form__actions">
        <button
          type="submit"
          className="settings-btn settings-btn--primary"
          disabled={!canWrite || saving}
        >
          {saving ? <Loader2 size={16} className="settings-spin" /> : null}
          {saving ? "Saving…" : "Save Webhook"}
        </button>
      </div>
    </form>
  );
}
