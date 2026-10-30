import { useCallback, useEffect, useState } from "react";
import {
  Box,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageSquare,
  Radio,
  RefreshCw,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  getApiKeys,
  regenerateLiveApiKey,
  regenerateTestApiKey,
} from "../../api/settings.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/settings-premium.css";

const API_BASE = "https://helpcentre-pro-api.onrender.com/api/v1";

const WIDGET_ENDPOINTS = [
  {
    method: "POST",
    path: "/public/widget/visitor",
    title: "Start chat",
    detail:
      "Start a chat. Name, email, and phone are optional — anonymous visitors work.",
    icon: UserPlus,
    required: true,
  },
  {
    method: "POST",
    path: "/public/widget/messages",
    title: "Send visitor message (left bubble)",
    detail: "Append a customer message to an open ticket.",
    icon: MessageSquare,
    required: true,
  },
  {
    method: "GET",
    path: "/public/widget/messages?ticketId=TK-…",
    title: "Get agent chat (poll replies)",
    detail:
      "Required. Poll every 1–3s so agent replies from Live Chat appear in your widget.",
    icon: Radio,
    required: true,
    highlight: true,
  },
  {
    method: "GET",
    path: "/public/widget/session",
    title: "Validate API key",
    detail: "Confirm the key and resolve workspace name / mode.",
    icon: KeyRound,
    required: false,
  },
  {
    method: "GET",
    path: "/public/widget/ticket-settings",
    title: "Ticket inactivity policy",
    detail:
      "Read how long open tickets stay idle before auto-close (configured in Settings → General).",
    icon: Radio,
    required: false,
  },
];

function isFullKey(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "—") return false;
  if (raw.includes("…") || raw.includes("...")) return false;
  return /^(pk|sk)_(test|live)_[a-f0-9]{16,}$/i.test(raw);
}

function maskSecret(value) {
  const raw = String(value || "");
  if (!raw || raw.includes("…") || raw.includes("...")) {
    return "••••••••••••••••••••••••";
  }
  if (raw.length <= 8) return "••••••••••••••••";
  return "••••••••••••••••••••••••";
}

function displayPublic(value, revealed) {
  const raw = String(value || "");
  if (!raw) return "—";
  if (revealed && isFullKey(raw)) return raw;
  if (raw.includes("…") || raw.includes("...")) return raw;
  if (raw.length <= 16) return raw;
  return `${raw.slice(0, 12)}…`;
}

function formatUpdatedAt(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function ApiKeyCard({
  title,
  badge,
  icon: Icon,
  iconClass,
  publicKey,
  secretKey,
  updatedAt,
  revealed,
  canWrite,
  busy,
  onRegenerate,
}) {
  const [showSecret, setShowSecret] = useState(Boolean(revealed));
  const [copied, setCopied] = useState("");
  const canCopyPublic = isFullKey(publicKey);
  const canCopySecret = isFullKey(secretKey);

  useEffect(() => {
    if (revealed) setShowSecret(true);
  }, [revealed, publicKey, secretKey]);

  async function copyText(label, value) {
    if (!isFullKey(value)) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="settings-card">
      <div className="settings-card__header-row">
        <div className="settings-card__title-row">
          <span className={`settings-card__icon ${iconClass || ""}`} aria-hidden="true">
            <Icon size={18} />
          </span>
          <h2 className="settings-card__title">{title}</h2>
          {badge ? (
            <span
              className={`settings-plan-badge${
                badge === "Development" ? " is-dev" : ""
              }`}
            >
              {badge}
            </span>
          ) : null}
        </div>
      </div>

      {revealed ? (
        <p className="settings-key-reveal-note" role="status">
          <ShieldAlert size={14} aria-hidden="true" />
          Previous keys for this mode are revoked. Copy these now — the secret
          will not be shown again after you leave this page.
        </p>
      ) : null}

      <div className="settings-key-block">
        <span className="settings-key-block__label">Public Key</span>
        <div className="settings-key-block__row">
          <code className="settings-key-block__value">
            {displayPublic(publicKey, revealed)}
          </code>
          <button
            type="button"
            className="settings-btn settings-btn--secondary settings-btn--sm"
            onClick={() => copyText("public", publicKey)}
            disabled={!canCopyPublic}
            title={
              canCopyPublic
                ? "Copy public key"
                : "Regenerate to reveal the full public key"
            }
          >
            {copied === "public" ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            Copy
          </button>
        </div>
      </div>

      <div className="settings-key-block">
        <span className="settings-key-block__label">Secret Key</span>
        <div className="settings-key-block__row">
          <code className="settings-key-block__value">
            {showSecret && canCopySecret ? secretKey : maskSecret(secretKey)}
          </code>
          <button
            type="button"
            className="settings-btn settings-btn--secondary settings-btn--sm"
            onClick={() => setShowSecret((v) => !v)}
            disabled={!canCopySecret}
          >
            {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            {showSecret ? "Hide key" : "Show key"}
          </button>
          <button
            type="button"
            className="settings-btn settings-btn--secondary settings-btn--sm"
            onClick={() => copyText("secret", secretKey)}
            disabled={!canCopySecret}
            title={
              canCopySecret
                ? "Copy secret key"
                : "Regenerate to reveal the full secret key"
            }
          >
            {copied === "secret" ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            Copy
          </button>
        </div>
      </div>

      <div className="settings-key-footer">
        <p className="settings-meta">Updated at: {formatUpdatedAt(updatedAt)}</p>
        {canWrite ? (
          <button
            type="button"
            className="settings-btn settings-btn--secondary settings-btn--sm"
            onClick={onRegenerate}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={14} className="settings-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Regenerate
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default function ApiTokensSettings() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("settings:write");

  const [keys, setKeys] = useState({ test: null, live: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getApiKeys();
      const data = res?.data || res || {};
      const apiKeys = data.apiKeys || data;
      const mapBucket = (bucket) => {
        if (!bucket) return null;
        return {
          publicKey: bucket.publicKey || bucket.publicKeyPrefix || "",
          secretKey: bucket.secretKey || bucket.secretKeyPrefix || "",
          updatedAt: bucket.updatedAt || null,
          revealed: false,
        };
      };
      setKeys({
        test: mapBucket(apiKeys.test),
        live: mapBucket(apiKeys.live),
      });
    } catch (err) {
      setError(err.message || "Failed to load API keys");
      setKeys({ test: null, live: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRegenerate(kind) {
    if (!canWrite || busy) return;
    const ok = window.confirm(
      kind === "test"
        ? "Regenerate test API keys?\n\nThe current test public and secret keys will be permanently revoked and removed. Existing test integrations will stop working until you paste the new keys."
        : "Regenerate live API keys?\n\nThe current live public and secret keys will be permanently revoked and removed. Production integrations will stop working until you paste the new keys."
    );
    if (!ok) return;

    setBusy(kind);
    setError("");
    setBanner("");
    try {
      const res =
        kind === "test"
          ? await regenerateTestApiKey()
          : await regenerateLiveApiKey();
      const data = res?.data || {};
      if (!isFullKey(data.publicKey) || !isFullKey(data.secretKey)) {
        throw new Error(
          "Regeneration succeeded but keys were incomplete. Please try again."
        );
      }
      setKeys((prev) => ({
        ...prev,
        [kind]: {
          publicKey: data.publicKey,
          secretKey: data.secretKey,
          updatedAt: data.updatedAt || new Date().toISOString(),
          revealed: true,
        },
      }));
      setBanner(
        res?.message ||
          `${kind === "test" ? "Test" : "Live"} keys rotated. Previous keys are revoked — copy the new secret now.`
      );
    } catch (err) {
      setError(err.message || "Unable to regenerate API key");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <div className="settings-card" role="status">
        <Loader2 className="settings-spin" size={18} /> Loading API tokens…
      </div>
    );
  }

  const test = keys.test || {};
  const live = keys.live || {};

  return (
    <div className="settings-stack">
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

      <div className="settings-api-grid">
        <ApiKeyCard
          title="Test API Keys"
          badge="Development"
          icon={Box}
          iconClass="settings-card__icon--dev"
          publicKey={test.publicKey || ""}
          secretKey={test.secretKey || ""}
          updatedAt={test.updatedAt}
          revealed={Boolean(test.revealed)}
          canWrite={canWrite}
          busy={busy === "test"}
          onRegenerate={() => handleRegenerate("test")}
        />
        <ApiKeyCard
          title="Live API Key"
          badge="Production"
          icon={KeyRound}
          iconClass="settings-card__icon--live"
          publicKey={live.publicKey || ""}
          secretKey={live.secretKey || ""}
          updatedAt={live.updatedAt}
          revealed={Boolean(live.revealed)}
          canWrite={canWrite}
          busy={busy === "live"}
          onRegenerate={() => handleRegenerate("live")}
        />
      </div>

      <section className="settings-card settings-widget-ref" aria-labelledby="widget-api-ref">
        <div className="settings-card__header-row">
          <div className="settings-card__title-row">
            <span className="settings-card__icon" aria-hidden="true">
              <Radio size={18} />
            </span>
            <h2 className="settings-card__title" id="widget-api-ref">
              Chat widget API
            </h2>
          </div>
        </div>
        <p className="settings-widget-ref__lead">
          Base URL <code>{API_BASE}</code>. Authenticate with{" "}
          <code>X-HCP-API-Key: pk_…</code> or{" "}
          <code>Authorization: Bearer sk_…</code>. Your external chat widget needs
          all required endpoints below — especially polling agent replies.
        </p>
        <ul className="settings-widget-ref__list">
          {WIDGET_ENDPOINTS.map((endpoint) => {
            const Icon = endpoint.icon;
            return (
              <li
                key={`${endpoint.method}-${endpoint.path}`}
                className={endpoint.highlight ? "is-highlight" : undefined}
              >
                <span className="settings-widget-ref__method" data-method={endpoint.method}>
                  {endpoint.method}
                </span>
                <div className="settings-widget-ref__body">
                  <div className="settings-widget-ref__title-row">
                    <Icon size={15} aria-hidden="true" />
                    <strong>{endpoint.title}</strong>
                    {endpoint.required ? (
                      <span className="settings-widget-ref__req">Required</span>
                    ) : (
                      <span className="settings-widget-ref__opt">Optional</span>
                    )}
                  </div>
                  <code className="settings-widget-ref__path">{endpoint.path}</code>
                  <p>{endpoint.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="settings-widget-ref__actions">
          <Link to="/docs/integration#poll-messages" className="settings-btn settings-btn--primary settings-btn--sm">
            <Radio size={14} />
            Poll agent replies guide
          </Link>
          <Link to="/docs/integration" className="settings-docs-link">
            <ExternalLink size={14} />
            Full integration documentation
          </Link>
        </div>
      </section>
    </div>
  );
}
