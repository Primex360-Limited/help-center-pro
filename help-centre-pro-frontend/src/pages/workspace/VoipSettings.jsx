import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Phone,
  Plus,
  Radar,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  discoverVoipWebSocket,
  getVoipSettings,
  saveVoipSettings,
  testVoipConnection,
} from "../../api/workspace.api.js";
import { SIP_DEFAULT_WSS } from "../../config/env.js";
import {
  PROVIDER_CATEGORIES,
  getProviderById,
  resolveSipCredentials,
} from "../../constants/voipProviders.js";
import VoipProviderLogo from "../../components/workspace/VoipProviderLogo.jsx";
import VoipProviderPickerModal from "../../components/workspace/VoipProviderPickerModal.jsx";
import VoipConfigModal from "../../components/workspace/VoipConfigModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import voipService from "../../services/voipService.js";
import "../../styles/app.css";
import "../../styles/auth.css";
import "../../styles/admin.css";
import "../../styles/workspace.css";
import "../../styles/voip-settings.css";

/**
 * Merge provider defaults (SIP host / port) into every stored configuration.
 * Old rows only carried number/username/password, which made the API answer
 * "SIP credentials incomplete. Server, username, and password are required."
 */
function normalizeConfigs(configs = []) {
  return (Array.isArray(configs) ? configs : []).map((config) => ({
    ...config,
    credentials: resolveSipCredentials(config.providerId, config.credentials || {}),
  }));
}

/** What this provider still needs before calls can work. */
function configReadiness(config, { platformDefaultWss = "" } = {}) {
  const credentials = resolveSipCredentials(
    config.providerId,
    config.credentials || {}
  );
  const host =
    credentials.sipServer ||
    credentials.sipDomain ||
    credentials.sipHost ||
    credentials.ipAddress ||
    credentials.ip ||
    "";
  const missing = [];
  if (!host) missing.push("server");
  if (!credentials.sipUsername) missing.push("username");
  if (!credentials.sipPassword) missing.push("password");

  if (missing.length) {
    return {
      tone: "red",
      label: `Missing ${missing.join(", ")}`,
      hint: "Open Edit and complete the provider credentials.",
    };
  }

  if (config.lastTest?.success && config.lastTest.source === "registration") {
    return {
      tone: "green",
      label: "Verified",
      hint: `Live SIP registration succeeded ${new Date(
        config.lastTest.at
      ).toLocaleString()}.`,
    };
  }

  if (!credentials.sipWsUrl) {
    // No WebSocket URL is no longer a dead end: the softphone resolves one
    // (platform gateway → server discovery → verified conventional endpoints)
    // before it registers, and every agent inherits the result.
    const gateway = platformDefaultWss || SIP_DEFAULT_WSS;
    const isRawIp = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(String(host));

    return {
      tone: "amber",
      label: gateway
        ? "Fields complete · gateway ready"
        : isRawIp
          ? "Fields complete · auto-detect"
          : "Fields complete · WSS auto",
      hint: gateway
        ? `Agents register through the platform WebRTC gateway (${gateway}). Paste a provider WSS URL to bypass it.`
        : "Help Centre Pro finds the provider's WebSocket automatically before each registration. Press “Detect WSS” to store the exact endpoint once, or paste one to override.",
    };
  }

  if (config.lastTest?.success) {
    return {
      tone: "amber",
      label: "Fields validated · run Test",
      hint: "Credentials are complete. Press Test to confirm the provider accepts a live browser registration.",
    };
  }

  return {
    tone: "amber",
    label: "Configured · test to verify",
    hint:
      config.lastTest?.message ||
      "Credentials are saved. Press Test to confirm the provider accepts the registration.",
  };
}

export default function VoipSettings({ embedded = false } = {}) {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("settings:write");

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [liveTests, setLiveTests] = useState({});
  const [configurations, setConfigurations] = useState([]);
  const [activeConfigId, setActiveConfigId] = useState("");
  const [acceptInbound, setAcceptInbound] = useState(true);
  const [platformDefaultWss, setPlatformDefaultWss] = useState(SIP_DEFAULT_WSS);
  const [detectingId, setDetectingId] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getVoipSettings();
      const data = res?.data || {};
      const normalized = normalizeConfigs(data.configurations);
      setSettings({ ...data, configurations: normalized });
      setConfigurations(normalized);
      setActiveConfigId(data.activeConfigId || "");
      setAcceptInbound(
        data.acceptInbound === undefined ? true : Boolean(data.acceptInbound)
      );
      if (data.platformDefaultWss) setPlatformDefaultWss(data.platformDefaultWss);
    } catch (err) {
      setError(err.message || "Failed to load VoIP settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const dirty = useMemo(() => {
    const savedInbound =
      settings?.acceptInbound === undefined
        ? true
        : Boolean(settings.acceptInbound);
    return (
      JSON.stringify(configurations) !==
        JSON.stringify(settings?.configurations || []) ||
      activeConfigId !== (settings?.activeConfigId || "") ||
      acceptInbound !== savedInbound
    );
  }, [configurations, activeConfigId, acceptInbound, settings]);

  const editingCredentials =
    editingIndex !== null
      ? configurations[editingIndex]?.credentials || null
      : null;

  function closeConfigModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingIndex(null);
    setSelectedProvider("");
  }

  function openProviderPicker() {
    if (!canWrite) {
      setError("You need settings write permission to add a VoIP/SIP provider.");
      return;
    }
    setEditingIndex(null);
    setSelectedProvider("");
    setModalOpen(false);
    setPickerOpen(true);
    setError("");
    setBanner("");
  }

  function handlePickProvider(providerId) {
    setPickerOpen(false);
    setEditingIndex(null);
    setSelectedProvider(providerId);
    setModalOpen(true);
  }

  function handleDiscard() {
    setConfigurations(settings?.configurations || []);
    setActiveConfigId(settings?.activeConfigId || "");
    setAcceptInbound(
      settings?.acceptInbound === undefined
        ? true
        : Boolean(settings.acceptInbound)
    );
    setPickerOpen(false);
    closeConfigModal();
    setBanner("");
    setError("");
  }

  function handleEditConfig(index) {
    const config = configurations[index];
    setPickerOpen(false);
    setSelectedProvider(config.providerId);
    setEditingIndex(index);
    setModalOpen(true);
    setError("");
  }

  function handleDeleteConfig(index) {
    if (!canWrite) return;
    const next = [...configurations];
    const deletedId = next[index].id;
    next.splice(index, 1);
    setConfigurations(next);
    if (activeConfigId === deletedId) {
      setActiveConfigId(next[0]?.id || "");
    }
    setBanner("Configuration removed. Click Save changes to apply.");
  }

  function handleSetActiveConfig(id) {
    if (!canWrite) return;
    setActiveConfigId(id);
    setBanner("Active provider updated. Click Save changes to apply.");
  }

  async function persistConfigs(
    nextConfigs,
    nextActiveId,
    successMessage,
    nextAcceptInbound = acceptInbound
  ) {
    setSaving(true);
    setError("");
    try {
      const res = await saveVoipSettings({
        configurations: nextConfigs,
        activeConfigId: nextActiveId,
        acceptInbound: nextAcceptInbound,
      });
      const data = res?.data || {};
      const inbound =
        data.acceptInbound === undefined
          ? nextAcceptInbound
          : Boolean(data.acceptInbound);
      setConfigurations(data.configurations || nextConfigs);
      setActiveConfigId(data.activeConfigId || nextActiveId || "");
      setAcceptInbound(inbound);
      setSettings({
        configurations: data.configurations || nextConfigs,
        activeConfigId: data.activeConfigId || nextActiveId || "",
        acceptInbound: inbound,
      });
      setBanner(successMessage);
      setPickerOpen(false);
      setModalOpen(false);
      setEditingIndex(null);
      setSelectedProvider("");
      try {
        await voipService.initialize({ force: true });
      } catch {
        /* registration may need Test — still saved */
      }
    } catch (err) {
      setError(err.message || "Failed to save VoIP settings");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleModalSubmit({ providerId, providerName, credentials }) {
    if (!canWrite || saving) return;

    const newConfig = {
      id:
        editingIndex !== null
          ? configurations[editingIndex].id
          : `voip-${Date.now()}`,
      providerId,
      providerName,
      // Persist the resolved credentials (provider host/port included) — the
      // API requires a server, and branded forms do not show one by default.
      credentials: resolveSipCredentials(providerId, credentials),
      enabled: true,
      createdAt:
        editingIndex !== null
          ? configurations[editingIndex].createdAt
          : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let nextConfigs;
    if (editingIndex !== null) {
      nextConfigs = [...configurations];
      nextConfigs[editingIndex] = newConfig;
    } else {
      nextConfigs = [...configurations, newConfig];
    }

    const nextActive =
      activeConfigId && nextConfigs.some((c) => c.id === activeConfigId)
        ? activeConfigId
        : newConfig.id;

    setConfigurations(nextConfigs);
    setActiveConfigId(nextActive);

    await persistConfigs(
      nextConfigs,
      nextActive,
      editingIndex !== null
        ? `${providerName} updated and saved.`
        : `${providerName} added and set active. Agents can place calls from Calls.`
    );
  }

  async function handleSaveSettings() {
    if (!canWrite || saving) return;
    try {
      await persistConfigs(
        normalizeConfigs(configurations),
        activeConfigId,
        "VoIP settings saved successfully"
      );
    } catch {
      /* error already set */
    }
  }

  /**
   * "Detect WSS" — ask the backend to probe the provider's network and store the
   * endpoint it finds. This is the one-click answer to "Stuncall gave me an IP
   * and a UDP port, and my agents cannot call".
   */
  async function handleDetectWs(configId) {
    if (detectingId) return;
    const config = configurations.find((entry) => entry.id === configId);
    if (!config) return;

    setDetectingId(configId);
    setTestResult(null);
    setError("");
    setBanner("");
    try {
      const res = await discoverVoipWebSocket({
        configId,
        providerId: config.providerId,
        persist: canWrite,
        force: true,
      });
      const payload = res?.data || {};
      const best = payload.wsUrl || payload.discovery?.best?.url || "";
      const notes = payload.discovery?.notes || [];

      if (!best) {
        const reason =
          notes[0] ||
          "No WebSocket endpoint answered from this provider's network.";
        setTestResult({
          configId,
          success: false,
          message: `${reason} Ask the provider for their WSS URL once — it then works for every agent.`,
          details: payload.discovery || null,
        });
        return;
      }

      if (payload.saved) {
        // The server stored it on the provider config; re-read so the card and
        // the "unsaved changes" indicator stay truthful.
        await loadSettings();
      } else {
        setConfigurations((prev) =>
          prev.map((entry) =>
            entry.id === configId
              ? {
                  ...entry,
                  credentials: { ...entry.credentials, sipWsUrl: best },
                }
              : entry
          )
        );
      }

      const message =
        payload.source === "tenant"
          ? payload.verified
            ? `Saved WebSocket URL verified: ${best}`
            : `Saved WebSocket URL could not be confirmed from the server (${best}). Keep it if your agents reach it.`
          : payload.source === "platform"
            ? `No provider WebSocket found — agents will register through the platform gateway (${best}).`
            : `WebSocket endpoint detected and verified: ${best}`;

      setTestResult({ configId, success: true, message, details: payload.discovery || null });
      setBanner(message);
    } catch (err) {
      const message = err.message || "WebSocket detection failed";
      setTestResult({ configId, success: false, message });
      setError(message);
    } finally {
      setDetectingId("");
    }
  }

  async function handleTestConnection(configId) {
    if (!canWrite || testing) return;
    const config = configurations.find((c) => c.id === configId);
    if (!config) return;

    setTesting(true);
    setTestResult(null);
    setError("");
    setBanner("");
    try {
      let live = null;
      try {
        live = await voipService.testRegistration(
          resolveSipCredentials(config.providerId, config.credentials || {}),
          { providerId: config.providerId }
        );
      } catch (liveErr) {
        live = {
          success: false,
          message: liveErr.message || "Live SIP registration failed",
        };
      }

      if (live?.success) {
        setTestResult({
          configId,
          success: true,
          message: live.message,
          details: live.details || null,
        });
        setLiveTests((prev) => ({
          ...prev,
          [config.id]: {
            at: new Date().toISOString(),
            success: true,
            source: "registration",
            message: live.message,
          },
        }));
        setBanner(live.message);
        return;
      }

      const res = await testVoipConnection(configId);
      const payload = res?.data || res || {};
      const message = live?.message
        ? `${live.message}${
            payload.success
              ? " Fields look valid — fix WSS URL / firewall so the browser can register."
              : ""
          }`
        : payload.message || res?.message || "Connection test failed";
      setTestResult({
        configId,
        success: false,
        message,
        details: {
          ...(payload.details || {}),
          liveRegistration: live,
        },
      });
      setLiveTests((prev) => ({
        ...prev,
        [config.id]: {
          at: new Date().toISOString(),
          success: false,
          source: "registration",
          message,
        },
      }));
      // Fields may be perfectly valid while the browser still cannot register
      // (no WSS). Only raise the page-level error when the API rejects them.
      if (!payload.success) setError(message);
    } catch (err) {
      setTestResult({
        configId,
        success: false,
        message: err.message || "Connection test failed",
      });
      setError(err.message || "Connection test failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className={embedded ? "voip-settings voip-settings--embedded" : "workspace-page"}>
        <div className="admin-card workspace-card" style={{ padding: 40, textAlign: "center" }}>
          <Loader2 className="workspace-spin" size={32} />
          <p style={{ marginTop: 16, color: "#667085" }}>Loading VoIP settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "voip-settings voip-settings--embedded" : "workspace-page"}>
      {!embedded ? (
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title" style={{ marginBottom: 4 }}>
              VoIP / SIP Settings
            </h1>
            <p className="admin-kpi__meta">
              Connect a free or BYO SIP provider. Once active, agents can place and
              receive calls worldwide from the browser softphone.
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
              onClick={handleSaveSettings}
              disabled={!canWrite || !dirty || saving}
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
      ) : (
        <div className="voip-embedded-toolbar">
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
            onClick={handleSaveSettings}
            disabled={!canWrite || !dirty || saving}
          >
            {saving ? (
              <Loader2 className="workspace-spin" size={16} aria-hidden="true" />
            ) : (
              <Save size={16} />
            )}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

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

      <section className="admin-card workspace-card">
        <div className="admin-card__header voip-section-head">
          <div>
            <h2>Configured Providers</h2>
            <p>
              Add your SIP credentials, set one provider active, then place and
              receive calls from Tickets → Calls.
            </p>
          </div>
          <label className="voip-inbound-toggle">
            <span>Accept inbound calls</span>
            <input
              type="checkbox"
              checked={acceptInbound}
              onChange={(e) => {
                if (!canWrite) return;
                setAcceptInbound(e.target.checked);
                setBanner(
                  e.target.checked
                    ? "Inbound calls enabled — click Save changes."
                    : "Inbound calls paused — click Save changes."
                );
              }}
              disabled={!canWrite}
              aria-label="Accept inbound calls"
            />
          </label>
        </div>

        {configurations.length === 0 ? (
          <div className="voip-empty voip-empty--dashed">
            <Phone size={40} aria-hidden="true" />
            <p>No VoIP/SIP providers configured yet</p>
            <p className="voip-empty__sub">
              Click Add provider to choose a VoIP/SIP provider and enter
              credentials without leaving Help Center Pro.
            </p>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={openProviderPicker}
              disabled={!canWrite}
            >
              <Plus size={16} />
              Add provider
            </button>
          </div>
        ) : (
          <>
            <div className="voip-config-list">
              {configurations.map((config, index) => {
                const isActive = config.id === activeConfigId;
                const cfgProvider = getProviderById(config.providerId);
                const testRes =
                  testResult?.configId === config.id ? testResult : null;
                const readiness = configReadiness(
                  {
                    ...config,
                    lastTest: liveTests[config.id] || config.lastTest,
                  },
                  { platformDefaultWss }
                );

                return (
                  <div
                    key={config.id}
                    className={`voip-config-card${isActive ? " is-active" : ""}`}
                  >
                    <div className="voip-config-card__main">
                      <div className="voip-config-card__header">
                        <div className="voip-config-card__provider">
                          <VoipProviderLogo
                            name={cfgProvider?.name || config.providerName}
                            website={cfgProvider?.website}
                            domain={cfgProvider?.logoDomain}
                            size={36}
                          />
                          <div>
                            <strong>
                              {cfgProvider?.name || config.providerName}
                            </strong>
                            <span>
                              {PROVIDER_CATEGORIES[cfgProvider?.category] ||
                                cfgProvider?.category ||
                                "Custom"}
                            </span>
                          </div>
                        </div>
                        <div className="voip-config-card__badges">
                          {isActive ? (
                            <span className="voip-badge voip-badge--active">
                              Active
                            </span>
                          ) : null}
                          <span
                            className={`voip-badge voip-badge--${readiness.tone}`}
                            title={readiness.hint}
                          >
                            {readiness.label}
                          </span>
                        </div>
                      </div>
                      <p className="voip-config-card__meta">
                        Added {new Date(config.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="voip-config-card__actions">
                      {canWrite ? (
                        <>
                          {!isActive ? (
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              onClick={() => handleSetActiveConfig(config.id)}
                            >
                              <CheckCircle2 size={14} />
                              Activate
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            onClick={() => handleEditConfig(index)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            onClick={() => handleTestConnection(config.id)}
                            disabled={testing}
                          >
                            {testing && testResult?.configId === config.id ? (
                              <Loader2 size={14} className="workspace-spin" />
                            ) : (
                              <Phone size={14} />
                            )}
                            Test
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            onClick={() => handleDetectWs(config.id)}
                            disabled={Boolean(detectingId)}
                            title={
                              config.credentials?.sipWsUrl
                                ? "Re-check the saved WebSocket URL and probe for a better one"
                                : "Probe the provider's network and store the WebSocket endpoint agents need"
                            }
                          >
                            {detectingId === config.id ? (
                              <Loader2 size={14} className="workspace-spin" />
                            ) : (
                              <Radar size={14} />
                            )}
                            Detect WSS
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost voip-btn--danger"
                            onClick={() => handleDeleteConfig(index)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : null}
                    </div>
                    {testRes ? (
                      <div
                        className={`voip-test-result${
                          testRes.success ? " is-success" : " is-error"
                        }`}
                      >
                        {testRes.success ? (
                          <CheckCircle2 size={14} aria-hidden="true" />
                        ) : (
                          <AlertCircle size={14} aria-hidden="true" />
                        )}
                        <span>{testRes.message}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {canWrite ? (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={openProviderPicker}
                style={{ marginTop: 16 }}
              >
                <Plus size={16} />
                Add Another Provider
              </button>
            ) : null}
          </>
        )}
      </section>

      {pickerOpen ? (
        <VoipProviderPickerModal
          canWrite={canWrite}
          onClose={() => setPickerOpen(false)}
          onSelect={handlePickProvider}
        />
      ) : null}

      {modalOpen && selectedProvider ? (
        <VoipConfigModal
          providerId={selectedProvider}
          initialCredentials={editingCredentials}
          mode={editingIndex !== null ? "edit" : "create"}
          saving={saving}
          canWrite={canWrite}
          onClose={closeConfigModal}
          onSubmit={handleModalSubmit}
        />
      ) : null}
    </div>
  );
}
