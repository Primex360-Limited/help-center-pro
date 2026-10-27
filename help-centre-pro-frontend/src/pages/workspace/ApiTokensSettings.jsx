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
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  getApiKeys,
  regenerateLiveApiKey,
  regenerateTestApiKey,
} from "../../api/settings.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/settings-premium.css";

function maskSecret(value) {
  const raw = String(value || "");
  if (!raw || raw.includes("…") || raw.includes("...")) {
    return "••••••••••••••••••••••••";
  }
  if (raw.length <= 8) return "••••••••••••••••";
  return "••••••••••••••••••••••••";
}

function displayPublic(value) {
  const raw = String(value || "");
  if (!raw) return "—";
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
  canWrite,
  busy,
  onRegenerate,
}) {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState("");

  async function copyText(label, value) {
    if (!value) return;
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

      <div className="settings-key-block">
        <span className="settings-key-block__label">Public Key</span>
        <div className="settings-key-block__row">
          <code className="settings-key-block__value">
            {displayPublic(publicKey)}
          </code>
          <button
            type="button"
            className="settings-btn settings-btn--secondary settings-btn--sm"
            onClick={() => copyText("public", publicKey)}
            disabled={!publicKey || publicKey === "—"}
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
            {showSecret ? secretKey || "—" : maskSecret(secretKey)}
          </code>
          <button
            type="button"
            className="settings-btn settings-btn--secondary settings-btn--sm"
            onClick={() => setShowSecret((v) => !v)}
            disabled={!secretKey}
          >
            {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            {showSecret ? "Hide key" : "Show key"}
          </button>
          <button
            type="button"
            className="settings-btn settings-btn--secondary settings-btn--sm"
            onClick={() => copyText("secret", secretKey)}
            disabled={!secretKey}
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
          revealed: Boolean(bucket.publicKey && bucket.secretKey),
        };
      };
      setKeys((prev) => ({
        test: mapBucket(apiKeys.test) || prev.test,
        live: mapBucket(apiKeys.live) || prev.live,
      }));
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
        ? "Regenerate the test API keys? Existing test integrations will stop working until updated."
        : "Regenerate the live API keys? Existing production integrations will stop working until updated."
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
      setKeys((prev) => ({
        ...prev,
        [kind]: {
          publicKey: data.publicKey || "",
          secretKey: data.secretKey || "",
          updatedAt: new Date().toISOString(),
          revealed: true,
        },
      }));
      setBanner(
        res?.message ||
          `${kind === "test" ? "Test" : "Live"} keys generated. Copy the secret now — it will not be shown again.`
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
          canWrite={canWrite}
          busy={busy === "live"}
          onRegenerate={() => handleRegenerate("live")}
        />
      </div>

      <Link to="/docs/integration" className="settings-docs-link">
        <ExternalLink size={14} />
        View integration documentation
      </Link>
    </div>
  );
}
