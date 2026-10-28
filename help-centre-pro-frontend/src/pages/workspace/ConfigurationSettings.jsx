import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { emailAccountsApi } from "../../api/email-accounts.api.js";
import ConfirmActionModal from "../../components/agents/ConfirmActionModal.jsx";
import AddEmailAccountModal from "../../components/workspace/AddEmailAccountModal.jsx";
import VoipSettings from "./VoipSettings.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/settings-premium.css";
import "../../styles/email-settings.css";
import "../../styles/admin.css";
import "../../styles/voip-settings.css";

const CHANNELS = [
  {
    id: "email",
    label: "Email",
    hint: "Sending and receiving account.",
    icon: Mail,
  },
  {
    id: "livechat",
    label: "Live chat",
    hint: "widget availability.",
    icon: MessageSquare,
  },
  {
    id: "call",
    label: "Call",
    hint: "Phone routing and voicemail.",
    icon: Phone,
  },
];

function initialsFromEmail(email = "") {
  const local = String(email).split("@")[0] || "?";
  const parts = local.split(/[._\-\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export default function ConfigurationSettings() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("settings:write");

  const [channel, setChannel] = useState("email");
  const [mailDirection, setMailDirection] = useState("outgoing");
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [providers, setProviders] = useState({
    gmailOAuth: true,
    outlookOAuth: true,
  });

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await emailAccountsApi.list();
      setAccounts(result.data || []);
    } catch (err) {
      setError(err.message || "Failed to load email accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      const result = await emailAccountsApi.getProvidersStatus();
      if (result.data) setProviders(result.data);
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadProviders();
  }, [loadAccounts, loadProviders]);

  async function handleAddGmail() {
    try {
      const result = await emailAccountsApi.getOAuthUrl("gmail", "configuration");
      window.open(result.data.authUrl, "_blank", "width=600,height=700");
      setTimeout(() => loadAccounts(), 5000);
    } catch (err) {
      setError(err.message || "Failed to initiate Gmail OAuth");
    }
  }

  async function handleAddOutlook() {
    try {
      const result = await emailAccountsApi.getOAuthUrl(
        "outlook",
        "configuration"
      );
      window.open(result.data.authUrl, "_blank", "width=600,height=700");
      setTimeout(() => loadAccounts(), 5000);
    } catch (err) {
      setError(err.message || "Failed to initiate Outlook OAuth");
    }
  }

  async function handleSetDefault(accountId) {
    setError("");
    setBanner("");
    try {
      await emailAccountsApi.update(accountId, { isDefault: true });
      setBanner("Default mailbox updated.");
      await loadAccounts();
    } catch (err) {
      setError(err.message || "Failed to set default account");
    }
  }

  function askRemoveAccount(account) {
    if (!canWrite || !account?.id) return;
    setRemoveError("");
    setRemoving(account);
  }

  async function confirmRemoveAccount() {
    if (!removing?.id || removeBusy) return;
    setRemoveBusy(true);
    setRemoveError("");
    setError("");
    setBanner("");
    try {
      const wasDefault = Boolean(removing.isDefault);
      await emailAccountsApi.delete(removing.id);
      setBanner(
        wasDefault
          ? `Removed ${removing.email}. Another mailbox is now the default if one remains.`
          : `Removed ${removing.email}. Sync and sending from that mailbox have stopped.`
      );
      setRemoving(null);
      await loadAccounts();
    } catch (err) {
      setRemoveError(err.message || "Failed to remove email account");
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <div className="settings-stack">
      {banner ? (
        <p className="settings-banner" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {banner}
        </p>
      ) : null}

      <div className="settings-channel-cards" role="tablist" aria-label="Channels">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={channel === c.id}
              className={`settings-channel-card${channel === c.id ? " is-active" : ""}`}
              onClick={() => setChannel(c.id)}
            >
              <span className="settings-channel-card__icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <span className="settings-channel-card__text">
                <strong>{c.label}</strong>
                <span>{c.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="settings-alert" role="alert">
          {error}
        </p>
      ) : null}

      {channel === "email" ? (
        <>
          <div className="settings-email-toolbar">
            <div className="settings-pill-tabs" role="group" aria-label="Mailbox direction">
              <button
                type="button"
                className={`settings-pill${mailDirection === "outgoing" ? " is-active" : ""}`}
                onClick={() => setMailDirection("outgoing")}
              >
                Outgoing Email Account
              </button>
              <button
                type="button"
                className={`settings-pill${mailDirection === "incoming" ? " is-active" : ""}`}
                onClick={() => setMailDirection("incoming")}
              >
                Incoming Email account
              </button>
            </div>
            {canWrite ? (
              <button
                type="button"
                className="settings-btn settings-btn--primary"
                onClick={() => setShowAddModal(true)}
              >
                Integrate new email account
              </button>
            ) : null}
          </div>

          {loading ? (
            <p className="settings-meta" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Loader2 size={14} className="settings-spin" /> Loading accounts…
            </p>
          ) : accounts.length ? (
            <div className="settings-account-list">
              {accounts.map((account) => (
                <div key={account.id} className="settings-account-row">
                  <div className="settings-account-row__info">
                    <div
                      className={`settings-account-row__avatar${
                        account.provider === "gmail"
                          ? " is-gmail"
                          : account.provider === "outlook"
                            ? " is-outlook"
                            : ""
                      }`}
                    >
                      {initialsFromEmail(account.email)}
                    </div>
                    <div className="settings-account-row__text">
                      <strong>
                        {account.email}
                        {account.isDefault ? (
                          <span className="settings-badge settings-badge--default">
                            Default
                          </span>
                        ) : null}
                      </strong>
                      <span>
                        {account.displayName ||
                          (account.provider === "gmail"
                            ? "Gmail"
                            : account.provider === "outlook"
                              ? "Outlook"
                              : "Custom mailbox")}
                      </span>
                    </div>
                  </div>
                  <div className="settings-account-row__actions">
                    {!account.isDefault && canWrite ? (
                      <button
                        type="button"
                        className="settings-btn settings-btn--secondary settings-btn--sm"
                        onClick={() => handleSetDefault(account.id)}
                      >
                        <Check size={14} />
                        Set default
                      </button>
                    ) : null}
                    {canWrite ? (
                      <button
                        type="button"
                        className="settings-btn settings-btn--danger-ghost settings-btn--sm"
                        onClick={() => askRemoveAccount(account)}
                        aria-label={`Remove ${account.email}`}
                        title="Remove mailbox"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="settings-meta">No email accounts connected yet.</p>
          )}
        </>
      ) : null}

      {channel === "livechat" ? (
        <section className="settings-card">
          <h2 className="settings-card__title">Live chat</h2>
          <p className="settings-card__desc">
            Widget availability follows agent presence in the Live Chat inbox.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link
              to="/workspace/settings/api-tokens"
              className="settings-btn settings-btn--primary"
            >
              API tokens
            </Link>
            <Link to="/docs/integration" className="settings-btn settings-btn--secondary">
              Integration docs
            </Link>
          </div>
        </section>
      ) : null}

      {channel === "call" ? (
        <section className="settings-card">
          <h2 className="settings-card__title">Call</h2>
          <p className="settings-card__desc">
            Phone routing and voicemail via your VoIP / SIP providers.
          </p>
          <Link
            to="/workspace/voip-settings"
            className="settings-btn settings-btn--primary"
          >
            Open VoIP settings
          </Link>
        </section>
      ) : null}

      {showAddModal ? (
        <AddEmailAccountModal
          onClose={() => setShowAddModal(false)}
          providers={providers}
          onAddGmail={handleAddGmail}
          onAddOutlook={handleAddOutlook}
          titleChoose={
            mailDirection === "incoming"
              ? "Integrate incoming email account"
              : "Integrate outgoing email account"
          }
          onConnected={async () => {
            setShowAddModal(false);
            setBanner("Mailbox connected.");
            await loadAccounts();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmActionModal
          title="Remove mailbox?"
          message={`Disconnect ${removing.email}? Help Centre Pro will stop sending and syncing from this account. Existing tickets stay in your inbox.`}
          confirmLabel="Remove mailbox"
          cancelLabel="Keep mailbox"
          tone="danger"
          busy={removeBusy}
          error={removeError}
          onConfirm={confirmRemoveAccount}
          onClose={() => {
            if (!removeBusy) {
              setRemoving(null);
              setRemoveError("");
            }
          }}
        />
      ) : null}
    </div>
  );
}
