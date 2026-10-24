import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Loader2,
  Phone,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  getVoipSettings,
  saveVoipSettings,
  testVoipConnection,
} from "../../api/workspace.api.js";
import SettingsTabs from "../../components/workspace/SettingsTabs.jsx";
import {
  VOIP_PROVIDERS,
  PROVIDER_CATEGORIES,
  getProviderById,
  getProviderCount,
} from "../../constants/voipProviders.js";
import { useAuth } from "../../context/AuthContext.jsx";
import voipService from "../../services/voipService.js";
import "../../styles/app.css";
import "../../styles/auth.css";
import "../../styles/admin.css";
import "../../styles/workspace.css";
import "../../styles/voip-settings.css";

function uniqueFields(fields = []) {
  const seen = new Set();
  return fields.filter((field) => {
    if (!field?.key || seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  });
}

function initialFormForProvider(providerId) {
  const provider = getProviderById(providerId);
  const initial = {};
  uniqueFields([
    ...(provider?.authFields || []),
    ...(provider?.sipFields || []),
  ]).forEach((field) => {
    if (field.default !== undefined) initial[field.key] = field.default;
  });
  // Prefill dial-out prefix from baked-in provider defaults (e.g. 2talk → 003)
  if (provider?.defaults?.dialOutPrefix && initial.dialOutPrefix === undefined) {
    initial.dialOutPrefix = provider.defaults.dialOutPrefix;
  }
  return initial;
}

export default function VoipSettings() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("settings:write");
  const formRef = useRef(null);

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [formData, setFormData] = useState({});
  const [configurations, setConfigurations] = useState([]);
  const [activeConfigId, setActiveConfigId] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getVoipSettings();
      const data = res?.data || {};
      setSettings(data);
      setConfigurations(data.configurations || []);
      setActiveConfigId(data.activeConfigId || "");
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
    return (
      JSON.stringify(configurations) !==
        JSON.stringify(settings?.configurations || []) ||
      activeConfigId !== (settings?.activeConfigId || "")
    );
  }, [configurations, activeConfigId, settings]);

  function scrollFormIntoView() {
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openAddForm(providerId = "custom_sip") {
    if (!canWrite) {
      setError("You need settings write permission to add a VoIP/SIP provider.");
      return;
    }
    const id = providerId || "custom_sip";
    setEditingIndex(null);
    setSelectedProvider(id);
    setFormData(initialFormForProvider(id));
    setShowAddForm(true);
    setError("");
    setBanner("");
    scrollFormIntoView();
  }

  function handleDiscard() {
    setConfigurations(settings?.configurations || []);
    setActiveConfigId(settings?.activeConfigId || "");
    setShowAddForm(false);
    setEditingIndex(null);
    setFormData({});
    setSelectedProvider("");
    setBanner("");
    setError("");
  }

  function handleEditConfig(index) {
    const config = configurations[index];
    setSelectedProvider(config.providerId);
    setFormData({ ...(config.credentials || {}) });
    setEditingIndex(index);
    setShowAddForm(true);
    setError("");
    scrollFormIntoView();
  }

  function handleDeleteConfig(index) {
    if (!canWrite) return;
    const newConfigs = [...configurations];
    const deletedId = newConfigs[index].id;
    newConfigs.splice(index, 1);
    setConfigurations(newConfigs);
    if (activeConfigId === deletedId) {
      setActiveConfigId(newConfigs[0]?.id || "");
    }
    setBanner("Configuration removed. Click Save changes to apply.");
  }

  function handleSetActiveConfig(id) {
    if (!canWrite) return;
    setActiveConfigId(id);
    setBanner("Active provider updated. Click Save changes to apply.");
  }

  function handleProviderChange(providerId) {
    setSelectedProvider(providerId);
    setFormData(initialFormForProvider(providerId));
  }

  function handleFormFieldChange(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function persistConfigs(nextConfigs, nextActiveId, successMessage) {
    setSaving(true);
    setError("");
    try {
      const res = await saveVoipSettings({
        configurations: nextConfigs,
        activeConfigId: nextActiveId,
      });
      const data = res?.data || {};
      setConfigurations(data.configurations || nextConfigs);
      setActiveConfigId(data.activeConfigId || nextActiveId || "");
      setSettings({
        configurations: data.configurations || nextConfigs,
        activeConfigId: data.activeConfigId || nextActiveId || "",
      });
      setBanner(successMessage);
      setShowAddForm(false);
      setEditingIndex(null);
      setSelectedProvider("");
      setFormData({});
    } catch (err) {
      setError(err.message || "Failed to save VoIP settings");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveConfig(event) {
    event?.preventDefault?.();
    if (!canWrite || !selectedProvider || saving) return;

    const provider = getProviderById(selectedProvider);
    if (!provider) {
      setError("Invalid provider selected");
      return;
    }

    const allFields = uniqueFields([
      ...(provider.authFields || []),
      ...(provider.sipFields || []),
    ]);
    for (const field of allFields) {
      if (field.type === "checkbox") continue;
      if (field.required && !String(formData[field.key] || "").trim()) {
        setError(`${field.label} is required`);
        return;
      }
    }

    const newConfig = {
      id:
        editingIndex !== null
          ? configurations[editingIndex].id
          : `voip-${Date.now()}`,
      providerId: selectedProvider,
      providerName: provider.name,
      credentials: { ...formData },
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

    try {
      await persistConfigs(
        nextConfigs,
        nextActive,
        editingIndex !== null
          ? `${provider.name} updated and saved.`
          : `${provider.name} added and set active. Agents can place calls from Calls.`
      );
    } catch {
      /* error already set */
    }
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

  const catalogProviders = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return VOIP_PROVIDERS.filter((item) => {
      if (catalogCategory !== "all" && item.category !== catalogCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        String(item.description || "")
          .toLowerCase()
          .includes(q) ||
        (item.regions || []).some((r) => String(r).toLowerCase().includes(q))
      );
    });
  }, [catalogQuery, catalogCategory]);

  const provider = selectedProvider ? getProviderById(selectedProvider) : null;
  const allFields = provider
    ? uniqueFields([...(provider.authFields || []), ...(provider.sipFields || [])])
    : [];
  const sipFields = uniqueFields(provider?.sipFields || []);

  if (loading) {
    return (
      <div className="workspace-page">
        <SettingsTabs />
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title" style={{ marginBottom: 4 }}>
              VoIP Settings
            </h1>
            <p className="admin-kpi__meta">Loading VoIP provider configurations...</p>
          </div>
        </div>
        <div className="admin-card workspace-card" style={{ padding: 40, textAlign: "center" }}>
          <Loader2 className="workspace-spin" size={32} />
          <p style={{ marginTop: 16, color: "#667085" }}>Loading VoIP settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <SettingsTabs />
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title" style={{ marginBottom: 4 }}>
            VoIP / SIP Settings
          </h1>
          <p className="admin-kpi__meta">
            Connect a free or BYO SIP provider — no Twilio. Once active, agents can
            call customers worldwide (including Nigeria) from the browser softphone.
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
        <div className="admin-card__header">
          <h2>Configured Providers</h2>
          <p>
            Add your SIP credentials, set one provider active, then place and
            receive calls from Tickets → Calls.
          </p>
        </div>

        {configurations.length === 0 && !showAddForm ? (
          <div className="voip-empty">
            <Phone size={48} aria-hidden="true" />
            <p>No VoIP/SIP providers configured yet</p>
            <p className="voip-empty__sub">
              Add Custom SIP / Free PBX or a Nigerian SIP provider. You need a
              WebSocket (WSS) SIP endpoint so the browser softphone can register.
            </p>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => openAddForm("custom_sip")}
              disabled={!canWrite}
            >
              <Plus size={16} />
              Add Provider
            </button>
          </div>
        ) : (
          <>
            {configurations.length > 0 ? (
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
                            <Globe2 size={20} aria-hidden="true" />
                            <div>
                              <strong>
                                {cfgProvider?.name || config.providerName}
                              </strong>
                              <span>{cfgProvider?.category || "Custom"}</span>
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
            ) : null}

            {canWrite && !showAddForm ? (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => openAddForm("custom_sip")}
                style={{ marginTop: 16 }}
              >
                <Plus size={16} />
                Add Another Provider
              </button>
            ) : null}
          </>
        )}
      </section>

      {showAddForm ? (
        <section
          ref={formRef}
          className="admin-card workspace-card voip-form-card voip-form-card--open"
        >
          <div className="admin-card__header">
            <h2>
              {editingIndex !== null ? "Edit Configuration" : "Add New Provider"}
            </h2>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={() => {
                setShowAddForm(false);
                setEditingIndex(null);
                setSelectedProvider("");
                setFormData({});
              }}
              aria-label="Close form"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSaveConfig} noValidate>
            <div className="workspace-field">
              <label htmlFor="voip-provider">Select Provider</label>
              <select
                id="voip-provider"
                className="ch-select ch-select--premium"
                value={selectedProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                disabled={!canWrite || editingIndex !== null}
                required
              >
                <option value="">Choose a provider...</option>
                {Object.entries(PROVIDER_CATEGORIES).map(([cat, label]) => (
                  <optgroup key={cat} label={label}>
                    {VOIP_PROVIDERS.filter((p) => p.category === cat).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {provider ? (
                <>
                  <p className="workspace-field__hint">{provider.description}</p>
                  <div className="voip-features">
                    {(provider.features || []).map((feature, i) => (
                      <span key={`${feature}-${i}`} className="voip-feature-tag">
                        {feature}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {provider && allFields.length > 0 ? (
              <>
                <div className="voip-field-group">
                  <h3>
                    {provider.simpleSetup
                      ? "Account details"
                      : "SIP configuration"}
                  </h3>
                  {provider.simpleSetup ? (
                    <p className="workspace-field__hint">
                      Same as LiveAgent-style setup: enter only what {provider.name}{" "}
                      gave you. Connection hosts are already configured for this
                      provider.
                    </p>
                  ) : (
                    <p className="workspace-field__hint">
                      Self-hosted / custom PBX — enter the SIP host and WSS URL
                      from your admin.
                    </p>
                  )}
                  {sipFields.map((field) =>
                    field.type === "checkbox" ? (
                      <label
                        key={field.key}
                        className="voip-checkbox"
                        htmlFor={`sip-${field.key}`}
                      >
                        <input
                          id={`sip-${field.key}`}
                          type="checkbox"
                          checked={Boolean(
                            formData[field.key] ?? field.default ?? false
                          )}
                          onChange={(e) =>
                            handleFormFieldChange(field.key, e.target.checked)
                          }
                          disabled={!canWrite}
                        />
                        <span>{field.label}</span>
                      </label>
                    ) : (
                      <div key={field.key} className="workspace-field">
                        <label htmlFor={`sip-${field.key}`}>
                          {field.label}
                          {field.required ? (
                            <span className="voip-required">*</span>
                          ) : null}
                        </label>
                        <input
                          id={`sip-${field.key}`}
                          type={field.type === "password" ? "password" : "text"}
                          value={formData[field.key] || ""}
                          onChange={(e) =>
                            handleFormFieldChange(field.key, e.target.value)
                          }
                          disabled={!canWrite}
                          placeholder={
                            field.placeholder ||
                            `Enter ${field.label.toLowerCase()}`
                          }
                          required={field.required}
                        />
                        {field.hint ? (
                          <p className="workspace-field__hint">{field.hint}</p>
                        ) : null}
                      </div>
                    )
                  )}
                </div>

                <div className="voip-form-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingIndex(null);
                      setSelectedProvider("");
                      setFormData({});
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-btn admin-btn--primary"
                    disabled={!canWrite || saving || !selectedProvider}
                  >
                    {saving ? (
                      <Loader2 className="workspace-spin" size={16} />
                    ) : null}
                    {editingIndex !== null
                      ? "Update & Save"
                      : "Add & Save Provider"}
                  </button>
                </div>
              </>
            ) : (
              <p className="workspace-field__hint">
                Choose a provider above to enter SIP credentials.
              </p>
            )}
          </form>
        </section>
      ) : null}

      <section className="admin-card workspace-card workspace-card--meta">
        <div className="admin-card__header">
          <h2>Choose a provider ({getProviderCount()})</h2>
          <p>
            Search or filter, then click a card. Branded providers only need
            number, username, and password — like LiveAgent.
          </p>
        </div>

        <div className="voip-catalog-filters">
          <input
            type="search"
            className="ch-input"
            placeholder="Search providers (e.g. MTN, 2talk, Nigeria, Telnyx)…"
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            aria-label="Search VoIP providers"
          />
          <select
            className="ch-select ch-select--premium"
            value={catalogCategory}
            onChange={(e) => setCatalogCategory(e.target.value)}
            aria-label="Filter by region"
          >
            <option value="all">All regions</option>
            {Object.entries(PROVIDER_CATEGORIES).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {catalogProviders.length === 0 ? (
          <p className="voip-empty__sub" style={{ padding: "24px 0" }}>
            No providers match your search. Try another name or use Custom SIP /
            Free PBX.
          </p>
        ) : (
          <div className="voip-providers-grid">
            {catalogProviders.map((item) => (
              <button
                key={item.id}
                type="button"
                className="voip-provider-info voip-provider-info--action"
                onClick={() => openAddForm(item.id)}
                disabled={!canWrite}
              >
                <div className="voip-provider-info__header">
                  <strong>{item.name}</strong>
                  <span
                    className={`voip-category-badge voip-category-badge--${item.category}`}
                  >
                    {PROVIDER_CATEGORIES[item.category] || item.category}
                  </span>
                </div>
                <p className="voip-provider-info__desc">{item.description}</p>
                <div className="voip-provider-info__features">
                  {item.supportsRecording ? (
                    <span className="voip-capability">Recording</span>
                  ) : null}
                  <span className="voip-capability voip-capability--cta">
                    Use provider <ChevronRight size={12} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
