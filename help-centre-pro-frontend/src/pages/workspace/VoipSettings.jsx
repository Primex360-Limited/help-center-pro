import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Phone,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  getVoipSettings,
  saveVoipSettings,
  testVoipConnection,
} from "../../api/workspace.api.js";
import {
  PROVIDER_CATEGORIES,
  getProviderById,
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
  const [configurations, setConfigurations] = useState([]);
  const [activeConfigId, setActiveConfigId] = useState("");
  const [acceptInbound, setAcceptInbound] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getVoipSettings();
      const data = res?.data || {};
      setSettings(data);
      setConfigurations(data.configurations || []);
      setActiveConfigId(data.activeConfigId || "");
      setAcceptInbound(
        data.acceptInbound === undefined ? true : Boolean(data.acceptInbound)
      );
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
      credentials: { ...credentials },
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
        configurations,
        activeConfigId,
        "VoIP settings saved successfully"
      );
    } catch {
      /* error already set */
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
        live = await voipService.testRegistration(config.credentials || {}, {
          providerId: config.providerId,
        });
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
      setError(message);
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
                        {isActive ? (
                          <span className="voip-badge voip-badge--active">
                            Active
                          </span>
                        ) : null}
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
