import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  Plus,
  RefreshCw,
  Settings2,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { emailAccountsApi } from "../../api/email-accounts.api.js";
import SettingsTabs from "../../components/workspace/SettingsTabs.jsx";
import "../../styles/email-settings.css";
import "../../styles/workspace.css";

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

  async function handleDeleteAccount(accountId) {
    if (!confirm("Are you sure you want to delete this email account? This will stop email synchronization for this account.")) {
      return;
    }

    try {
      await emailAccountsApi.delete(accountId);
      await loadAccounts();
    } catch (err) {
      setError(err.message || "Failed to delete email account");
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
      <SettingsTabs />
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
                      onClick={() => handleDeleteAccount(account.id)}
                    >
                      <Trash2 size={14} />
                      Delete
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
    </div>
  );
}

const MAILBOX_PRESETS = {
  gmail: {
    label: "Gmail (app password)",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false,
    hint: "In Google Account → Security, enable 2-Step Verification, then create an App Password for “Mail”. Use that 16-character password here — not your normal password.",
  },
  outlook: {
    label: "Outlook / Microsoft 365 (app password)",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
    hint: "In Microsoft Account → Security → Advanced security options, create an App Password. Some tenants have app passwords disabled — then use OAuth sign-in instead.",
  },
  yahoo: {
    label: "Yahoo Mail (app password)",
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
    hint: "In Yahoo Account Security, generate an App Password for “Other app”.",
  },
  zoho: {
    label: "Zoho Mail (app password)",
    imapHost: "imap.zoho.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.zoho.com",
    smtpPort: 587,
    smtpSecure: false,
    hint: "In Zoho Mail → Settings → Mail Accounts, enable IMAP access, then create an App Password under Zoho Account → Security.",
  },
  icloud: {
    label: "iCloud Mail (app-specific password)",
    imapHost: "imap.mail.me.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpSecure: false,
    hint: "At appleid.apple.com → Sign-In and Security, create an App-Specific Password. Your username is your full iCloud email address.",
  },
  custom: {
    label: "My own mail server (IMAP/SMTP)",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    hint: "Enter the IMAP and SMTP settings from your hosting provider (cPanel, Zoho, Titan, etc.). Use an app password if your provider offers one.",
  },
};

function AddEmailAccountModal({ onClose, providers, onAddGmail, onAddOutlook, onConnected }) {
  const [view, setView] = useState("choose");
  const [presetKey, setPresetKey] = useState("gmail");
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    password: "",
    ...MAILBOX_PRESETS.gmail,
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [testResult, setTestResult] = useState("");

  function pickPreset(key) {
    setPresetKey(key);
    setForm((f) => ({ ...f, ...MAILBOX_PRESETS[key] }));
    setFormError("");
    setTestResult("");
  }

  async function handleConnectMailbox(e) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    setTestResult("");
    const payload = {
      provider: "custom",
      email: form.email.trim(),
      displayName: form.displayName.trim() || form.email.trim(),
      password: form.password,
      imapHost: form.imapHost.trim(),
      imapPort: Number(form.imapPort),
      imapSecure: Boolean(form.imapSecure),
      smtpHost: form.smtpHost.trim(),
      smtpPort: Number(form.smtpPort),
      smtpSecure: Boolean(form.smtpSecure),
      isDefault: true,
    };
    try {
      let account;
      try {
        const created = await emailAccountsApi.create(payload);
        account = created.data;
      } catch (createErr) {
        if (createErr.status !== 409) throw createErr;
        // Already connected before — treat this as a reconnect: update the
        // stored app password and server settings, then re-test.
        const list = await emailAccountsApi.list();
        const existing = (list.data || []).find(
          (a) => a.email?.toLowerCase() === payload.email.toLowerCase()
        );
        if (!existing) throw createErr;
        const updated = await emailAccountsApi.update(existing.id, payload);
        account = updated.data || existing;
        setTestResult("Existing mailbox found — credentials updated, re-testing…");
      }
      const [imap, smtp] = await Promise.all([
        emailAccountsApi.testImap(account.id).catch((err) => ({ data: { success: false, message: err.message } })),
        emailAccountsApi.testSmtp(account.id).catch((err) => ({ data: { success: false, message: err.message } })),
      ]);
      if (imap.data?.success && smtp.data?.success) {
        setTestResult("Mailbox connected and verified — sending and sync are live. Importing your latest mail…");
        emailAccountsApi.syncAccount(account.id).catch(() => {});
        setTimeout(onConnected, 1200);
      } else {
        setTestResult(
          `Connected, but checks failed — IMAP: ${imap.data?.message || "ok"} · SMTP: ${smtp.data?.message || "ok"}. Edit the server settings and test again from the account card.`
        );
        setTimeout(onConnected, 2600);
      }
    } catch (err) {
      setFormError(err.message || "Unable to connect mailbox");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    width: "100%",
    height: 42,
    padding: "0 12px",
    border: "1px solid #d0d5dd",
    borderRadius: 10,
    fontSize: 14,
    marginBottom: 10,
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal--email-account">
        <header className="modal__header">
          <h2>{view === "choose" ? "Add Email Account" : "Connect your mailbox"}</h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>

        <div className="modal__body">
          {view === "choose" ? (
            <>
              <div className="email-provider-options">
                <button
                  type="button"
                  className="provider-card"
                  onClick={onAddGmail}
                  disabled={!providers.gmailOAuth}
                  title={providers.gmailOAuth ? "" : "Google sign-in is not configured on this server — use app password below"}
                  style={!providers.gmailOAuth ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
                >
                  <div className="provider-card__icon provider-card__icon--gmail">G</div>
                  <h3>Gmail</h3>
                  <p>
                    {providers.gmailOAuth
                      ? "Sign in with Google (OAuth) — recommended"
                      : "Admin setup required — use app password below"}
                  </p>
                  <ExternalLink size={16} />
                </button>

                <button
                  type="button"
                  className="provider-card"
                  onClick={onAddOutlook}
                  disabled={!providers.outlookOAuth}
                  title={providers.outlookOAuth ? "" : "Microsoft sign-in is not configured on this server — use app password below"}
                  style={!providers.outlookOAuth ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
                >
                  <div className="provider-card__icon provider-card__icon--outlook">O</div>
                  <h3>Outlook</h3>
                  <p>
                    {providers.outlookOAuth
                      ? "Sign in with Microsoft (OAuth) — recommended"
                      : "Admin setup required — use app password below"}
                  </p>
                  <ExternalLink size={16} />
                </button>

                <button type="button" className="provider-card" onClick={() => setView("mailbox")}>
                  <div className="provider-card__icon provider-card__icon--custom">
                    <Settings2 size={24} />
                  </div>
                  <h3>Any mailbox (app password)</h3>
                  <p>Gmail, Outlook, Yahoo, Zoho, cPanel &amp; more via IMAP/SMTP</p>
                  <ExternalLink size={16} />
                </button>
              </div>

              <div className="email-security-notice">
                <Shield size={16} />
                <p>
                  Two-way sync: customer mail lands in HelpCentre Pro, replies are
                  sent from your real mailbox and filed in your Sent folder — and
                  mail you send directly from your mail app appears on the ticket.
                  Credentials are encrypted and never shown again.
                </p>
              </div>
            </>
          ) : (
            <form onSubmit={handleConnectMailbox}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Mailbox type
              </label>
              <select
                value={presetKey}
                onChange={(e) => pickPreset(e.target.value)}
                style={inputStyle}
              >
                {Object.entries(MAILBOX_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 12.5, color: "#667085", margin: "0 0 12px" }}>
                {MAILBOX_PRESETS[presetKey].hint}
              </p>
              <input
                style={inputStyle}
                type="email"
                required
                placeholder="Email address (e.g. support@yourcompany.com)"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                style={inputStyle}
                type="text"
                placeholder="Display name (e.g. Primex Support)"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
              <input
                style={inputStyle}
                type="password"
                required
                placeholder="App password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                <input
                  style={inputStyle}
                  required
                  placeholder="IMAP host"
                  value={form.imapHost}
                  onChange={(e) => setForm({ ...form, imapHost: e.target.value })}
                />
                <input
                  style={inputStyle}
                  required
                  type="number"
                  placeholder="993"
                  value={form.imapPort}
                  onChange={(e) => setForm({ ...form, imapPort: e.target.value })}
                />
                <input
                  style={inputStyle}
                  required
                  placeholder="SMTP host"
                  value={form.smtpHost}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                />
                <input
                  style={inputStyle}
                  required
                  type="number"
                  placeholder="587"
                  value={form.smtpPort}
                  onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                />
              </div>
              {formError ? (
                <p style={{ color: "#b42318", fontSize: 13 }}>{formError}</p>
              ) : null}
              {testResult ? (
                <p style={{ color: "#027a48", fontSize: 13 }}>{testResult}</p>
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn--ghost" onClick={() => setView("choose")}>
                  Back
                </button>
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  {busy ? "Connecting & testing…" : "Connect mailbox"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
