import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Mail,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { emailAccountsApi } from "../../api/email-accounts.api.js";
import ConfirmActionModal from "../../components/agents/ConfirmActionModal.jsx";
import AddEmailAccountModal from "../../components/workspace/AddEmailAccountModal.jsx";
import "../../styles/email-settings.css";
import "../../styles/workspace.css";
import "../../styles/admin.css";

export default function EmailSettings() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [expandedAccountId, setExpandedAccountId] = useState(null);
  const [testingConnection, setTestingConnection] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [workerStats, setWorkerStats] = useState(null);
  const [providers, setProviders] = useState({ gmailOAuth: true, outlookOAuth: true });
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");

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

  const loadWorkerStats = useCallback(async () => {
    try {
      const result = await emailAccountsApi.getWorkerStats();
      setWorkerStats(result.data);
    } catch (err) {
      console.error("Failed to load worker stats:", err);
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
    loadWorkerStats();
    loadProviders();
  }, [loadAccounts, loadWorkerStats, loadProviders]);

  async function handleAddGmail() {
    try {
      const result = await emailAccountsApi.getOAuthUrl("gmail", "email-settings");
      const authUrl = result.data.authUrl;
      window.open(authUrl, "_blank", "width=600,height=700");
      
      // Poll for account creation (simplified - in production, use WebSocket or callback)
      setTimeout(() => loadAccounts(), 5000);
    } catch (err) {
      setError(err.message || "Failed to initiate Gmail OAuth");
    }
  }

  async function handleAddOutlook() {
    try {
      const result = await emailAccountsApi.getOAuthUrl("outlook", "email-settings");
      const authUrl = result.data.authUrl;
      window.open(authUrl, "_blank", "width=600,height=700");
      
      setTimeout(() => loadAccounts(), 5000);
    } catch (err) {
      setError(err.message || "Failed to initiate Outlook OAuth");
    }
  }

  function askRemoveAccount(account) {
    if (!account?.id) return;
    setRemoveError("");
    setRemoving(account);
  }

  async function confirmRemoveAccount() {
    if (!removing?.id || removeBusy) return;
    setRemoveBusy(true);
    setRemoveError("");
    setError("");
    try {
      await emailAccountsApi.delete(removing.id);
      if (expandedAccountId === removing.id) setExpandedAccountId(null);
      setRemoving(null);
      await loadAccounts();
    } catch (err) {
      setRemoveError(err.message || "Failed to remove email account");
    } finally {
      setRemoveBusy(false);
    }
  }

  async function handleSetDefault(accountId) {
    try {
      await emailAccountsApi.update(accountId, { isDefault: true });
      await loadAccounts();
    } catch (err) {
      setError(err.message || "Failed to set default account");
    }
  }

  async function handleToggleSync(accountId, currentStatus) {
    try {
      await emailAccountsApi.update(accountId, { syncEnabled: !currentStatus });
      await loadAccounts();
    } catch (err) {
      setError(err.message || "Failed to update sync settings");
    }
  }

  async function handleTestConnection(accountId, type) {
    setTestingConnection(`${accountId}-${type}`);
    try {
      const result = type === "imap" 
        ? await emailAccountsApi.testImap(accountId)
        : await emailAccountsApi.testSmtp(accountId);
      
      if (result.data.success) {
        alert(`${type.toUpperCase()} connection successful!`);
      } else {
        alert(`${type.toUpperCase()} connection failed: ${result.data.message}`);
      }
    } catch (err) {
      alert(`${type.toUpperCase()} connection failed: ${err.message}`);
    } finally {
      setTestingConnection(null);
    }
  }

  async function handleSyncAccount(accountId) {
    setSyncing(accountId);
    try {
      const result = await emailAccountsApi.syncAccount(accountId);
      alert(result.data.success ? "Sync completed successfully" : "Sync completed with errors");
      await loadAccounts();
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(null);
    }
  }

  async function handleSyncAll() {
    setSyncing("all");
    try {
      const result = await emailAccountsApi.syncAll();
      alert("Sync triggered for all accounts");
      await loadAccounts();
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(null);
    }
  }

  function toggleExpand(accountId) {
    setExpandedAccountId(expandedAccountId === accountId ? null : accountId);
  }

  if (loading) {
    return (
      <div className="email-settings">
        <div className="email-settings__loading">Loading email accounts...</div>
      </div>
    );
  }

  return (
    <div className="email-settings">
      <header className="email-settings__header">
        <div>
          <h1>Email Accounts</h1>
          <p>Connect your email accounts for bidirectional synchronization</p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={18} />
          Add Account
        </button>
      </header>

      {error && (
        <div className="email-settings__error">
          <X size={16} />
          {error}
        </div>
      )}

      {workerStats && (
        <div className="email-settings__stats">
          <div className="stat-item">
            <span className="stat-label">Worker Status</span>
            <span className={`stat-value ${workerStats.isRunning ? "stat-value--active" : ""}`}>
              {workerStats.isRunning ? "Running" : "Stopped"}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Syncs</span>
            <span className="stat-value">{workerStats.totalSyncs || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Successful</span>
            <span className="stat-value stat-value--success">{workerStats.successfulSyncs || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Failed</span>
            <span className="stat-value stat-value--error">{workerStats.failedSyncs || 0}</span>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleSyncAll}
            disabled={syncing === "all"}
          >
            <RefreshCw size={14} className={syncing === "all" ? "spinning" : ""} />
            Sync All
          </button>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="email-settings__empty">
          <Mail size={48} />
          <h2>No email accounts connected</h2>
          <p>Connect your Gmail or Outlook account to enable bidirectional email synchronization</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowAddModal(true)}
          >
            Connect Your First Account
          </button>
        </div>
      ) : (
        <div className="email-settings__list">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`email-account-card ${expandedAccountId === account.id ? "is-expanded" : ""}`}
            >
              <div className="email-account-card__header">
                <div className="email-account-card__info">
                  <div className="email-account-card__icon">
                    {account.provider === "gmail" ? "G" : account.provider === "outlook" ? "O" : "E"}
                  </div>
                  <div>
                    <h3>{account.displayName || account.email}</h3>
                    <p>{account.email}</p>
                  </div>
                  {account.isDefault && (
                    <span className="badge badge--default">Default</span>
                  )}
                  {!account.isActive && (
                    <span className="badge badge--inactive">Inactive</span>
                  )}
                </div>
                <div className="email-account-card__status">
                  {account.lastSyncStatus === "completed" && (
                    <span className="status status--success">
                      <Check size={14} />
                      Synced {account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleString() : "Never"}
                    </span>
                  )}
                  {account.lastSyncStatus === "error" && (
                    <span className="status status--error">
                      Sync Error: {account.syncError}
                    </span>
                  )}
                  {account.lastSyncStatus === "syncing" && (
                    <span className="status status--syncing">
                      <RefreshCw size={14} className="spinning" />
                      Syncing...
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  onClick={() => toggleExpand(account.id)}
                  aria-label="Toggle details"
                >
                  {expandedAccountId === account.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {expandedAccountId === account.id && (
                <div className="email-account-card__details">
                  <div className="detail-row">
                    <span className="detail-label">Provider</span>
                    <span className="detail-value">{account.provider}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">IMAP Host</span>
                    <span className="detail-value">{account.imapHost}:{account.imapPort}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">SMTP Host</span>
                    <span className="detail-value">{account.smtpHost}:{account.smtpPort}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Sync Enabled</span>
                    <span className="detail-value">{account.syncEnabled ? "Yes" : "No"}</span>
                  </div>

                  <div className="email-account-card__actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => handleTestConnection(account.id, "imap")}
                      disabled={testingConnection === `${account.id}-imap`}
                    >
                      <Settings2 size={14} />
                      Test IMAP
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => handleTestConnection(account.id, "smtp")}
                      disabled={testingConnection === `${account.id}-smtp`}
                    >
                      <Settings2 size={14} />
                      Test SMTP
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => handleSyncAccount(account.id)}
                      disabled={syncing === account.id}
                    >
                      <RefreshCw size={14} className={syncing === account.id ? "spinning" : ""} />
                      Sync Now
                    </button>
                    {!account.isDefault && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => handleSetDefault(account.id)}
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => handleToggleSync(account.id, account.syncEnabled)}
                    >
                      {account.syncEnabled ? "Disable Sync" : "Enable Sync"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => askRemoveAccount(account)}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddEmailAccountModal
          titleChoose="Add Email Account"
          onClose={() => setShowAddModal(false)}
          providers={providers}
          onAddGmail={handleAddGmail}
          onAddOutlook={handleAddOutlook}
          onConnected={async () => {
            setShowAddModal(false);
            await loadAccounts();
          }}
        />
      )}

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
