import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, Radar, ShieldCheck, X } from "lucide-react";
import { discoverVoipWebSocket } from "../../api/workspace.api.js";
import {
  getProviderById,
  PROVIDER_CATEGORIES,
  primaryRegionLabel,
} from "../../constants/voipProviders.js";
import { providerWebDomain } from "../../utils/sipWebSocket.js";
import VoipProviderLogo from "./VoipProviderLogo.jsx";

function uniqueFields(fields = []) {
  const seen = new Set();
  return fields.filter((field) => {
    if (!field?.key || seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  });
}

function buildInitialForm(providerId, credentials = null) {
  const provider = getProviderById(providerId);
  const defaults =
    provider?.defaults && typeof provider.defaults === "object"
      ? provider.defaults
      : {};
  const initial = {};

  // Provider defaults first (SIP host / port), so a branded provider never
  // saves an empty server, then the tenant's own values on top.
  uniqueFields([
    ...(provider?.authFields || []),
    ...(provider?.sipFields || []),
  ]).forEach((field) => {
    if (defaults[field.key] !== undefined && defaults[field.key] !== "") {
      initial[field.key] = defaults[field.key];
    }
    if (field.default !== undefined) initial[field.key] = field.default;
  });

  if (credentials && typeof credentials === "object") {
    Object.entries(credentials).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        initial[key] = value;
      }
    });
  }

  return initial;
}

/**
 * Premium VoIP/SIP configuration modal — opens when an agent picks a provider.
 */
export default function VoipConfigModal({
  providerId,
  initialCredentials = null,
  mode = "create",
  saving = false,
  canWrite = true,
  onClose,
  onSubmit,
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const provider = useMemo(() => getProviderById(providerId), [providerId]);
  const [formData, setFormData] = useState(() =>
    buildInitialForm(providerId, initialCredentials)
  );
  const [localError, setLocalError] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [wsStatus, setWsStatus] = useState("");

  const sipFields = useMemo(
    () => uniqueFields(provider?.sipFields || []),
    [provider]
  );
  const allFields = useMemo(
    () =>
      uniqueFields([
        ...(provider?.authFields || []),
        ...(provider?.sipFields || []),
      ]),
    [provider]
  );

  const { primaryFields, advancedFields } = useMemo(() => {
    const primary = [];
    const advanced = [];
    for (const field of sipFields) {
      if (field.group === "advanced") advanced.push(field);
      else primary.push(field);
    }
    return { primaryFields: primary, advancedFields: advanced };
  }, [sipFields]);

  // Providers without a verified public endpoint need the host up front, so the
  // advanced section starts expanded instead of silently failing validation.
  const [advancedOpen, setAdvancedOpen] = useState(
    () => Boolean(getProviderById(providerId)?.requiresHost)
  );

  useEffect(() => {
    setFormData(buildInitialForm(providerId, initialCredentials));
    setLocalError("");
    setWsStatus("");
    setAdvancedOpen(Boolean(getProviderById(providerId)?.requiresHost));
  }, [providerId, initialCredentials]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose?.();
    }

    document.addEventListener("keydown", onKeyDown);
    // Focus first interactive field for keyboard users.
    const firstInput = panelRef.current?.querySelector(
      "input:not([type='checkbox']), select, textarea, button"
    );
    firstInput?.focus?.();

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, saving]);

  function handleFieldChange(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (localError) setLocalError("");
  }

  /**
   * Probe the provider's network for its WebSocket endpoint and prefill the
   * field. Agents never have to know this URL exists — this is only for admins
   * who want to pin it — but it turns "ask your carrier and hope" into one click.
   */
  async function handleDetectWs() {
    const host =
      String(formData.sipServer || "").trim() ||
      String(provider?.defaults?.sipServer || "").trim();

    if (!host) {
      setWsStatus("Add the SIP server / IP first — detection needs a host.");
      return;
    }

    setDetecting(true);
    setWsStatus("");
    try {
      const response = await discoverVoipWebSocket({
        providerId: provider?.id || "",
        host,
        providerDomain: providerWebDomain(provider),
        providerWsUrl: formData.sipWsUrl || "",
        force: true,
      });
      const payload = response?.data || {};
      const best = payload.wsUrl || payload.discovery?.best?.url || "";

      if (!best) {
        setWsStatus(
          payload.discovery?.notes?.[0] ||
            "No WebSocket endpoint answered. Leave this empty — the softphone keeps trying, or ask the provider for their WSS URL."
        );
        return;
      }

      setFormData((prev) => ({ ...prev, sipWsUrl: best }));
      setWsStatus(
        payload.source === "tenant"
          ? payload.verified
            ? "Your URL answered a real WebSocket handshake — keep it."
            : "Your URL did not answer from the server. Keep it if your PBX is only reachable from your network."
          : payload.source === "platform"
            ? `No provider WebSocket found; using the platform gateway (${best}).`
            : "Detected and verified with a real WebSocket handshake."
      );
    } catch (error) {
      setWsStatus(error?.message || "Detection failed — you can paste the URL instead.");
    } finally {
      setDetecting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canWrite || saving || !provider) return;

    for (const field of allFields) {
      if (field.type === "checkbox") continue;
      if (field.required && !String(formData[field.key] || "").trim()) {
        if (field.group === "advanced") setAdvancedOpen(true);
        setLocalError(
          `${field.label} is required${field.group === "advanced" ? " — open Advanced SIP settings below" : ""}`
        );
        return;
      }
    }

    setLocalError("");
    try {
      await onSubmit?.({
        providerId: provider.id,
        providerName: provider.name,
        credentials: { ...formData },
      });
    } catch (err) {
      setLocalError(err?.message || "Unable to save configuration");
    }
  }

  if (!provider) return null;

  const region = primaryRegionLabel(provider.regions);
  const categoryLabel =
    PROVIDER_CATEGORIES[provider.category] || provider.category || "Custom";
  const isEdit = mode === "edit";

  return (
    <div
      className="voip-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className="voip-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="voip-modal__header">
          <div className="voip-modal__brand">
            <VoipProviderLogo
              name={provider.name}
              website={provider.website}
              domain={provider.logoDomain}
              size={48}
            />
            <div>
              <p className="voip-modal__eyebrow">
                {isEdit ? "Edit configuration" : "Configure provider"}
              </p>
              <h2 id={titleId}>{provider.name}</h2>
              <p className="voip-modal__meta">
                {categoryLabel}
                {region ? ` · ${region}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="voip-modal__close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <form className="voip-modal__form" onSubmit={handleSubmit} noValidate>
          <div className="voip-modal__body">
            <p className="voip-modal__lead">
              {provider.simpleSetup
                ? `Enter the account details ${provider.name} gave you. Hosts and ports are already set for this provider.`
                : "Enter SIP host and WebSocket details from your PBX admin console."}
            </p>

            {(provider.features || []).length ? (
              <div className="voip-modal__features" aria-label="Capabilities">
                {(provider.features || []).map((feature, index) => (
                  <span key={`${feature}-${index}`} className="voip-feature-tag">
                    {feature}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="voip-modal__secure">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>
                Credentials stay in your workspace. Agents never leave Help Center
                Pro to finish this setup.
              </span>
            </div>

            {provider.requiresHost ? (
              <p className="voip-modal__notice">
                {provider.id === "custom_sip" ? (
                  <>
                    Enter the SIP host/IP from your PBX admin — that is all a
                    browser needs. The WebSocket (WSS) URL is detected
                    automatically, but you can pin it under{" "}
                    <strong>Advanced SIP settings</strong> if your PBX uses a
                    custom path.
                  </>
                ) : (
                  <>
                    {provider.name} assigns the SIP host per account. Paste the host /
                    IP from their welcome email under{" "}
                    <strong>Advanced SIP settings</strong> — without it the provider
                    cannot register.
                  </>
                )}
              </p>
            ) : null}

            {localError ? (
              <p className="voip-modal__error" role="alert">
                {localError}
              </p>
            ) : null}

            <div className="voip-modal__fields">
              <h3>{provider.simpleSetup ? "Account details" : "SIP configuration"}</h3>
              {primaryFields.map((field) =>
                field.type === "checkbox" ? (
                  <label
                    key={field.key}
                    className="voip-checkbox voip-checkbox--modal"
                    htmlFor={`voip-modal-${field.key}`}
                  >
                    <input
                      id={`voip-modal-${field.key}`}
                      type="checkbox"
                      checked={Boolean(
                        formData[field.key] ?? field.default ?? false
                      )}
                      onChange={(e) =>
                        handleFieldChange(field.key, e.target.checked)
                      }
                      disabled={!canWrite || saving}
                    />
                    <span>{field.label}</span>
                  </label>
                ) : (
                  <div key={field.key} className="voip-modal__field">
                    <label htmlFor={`voip-modal-${field.key}`}>
                      {field.label}
                      {field.required ? (
                        <span className="voip-required">*</span>
                      ) : null}
                    </label>
                    <input
                      id={`voip-modal-${field.key}`}
                      className="voip-modal__input"
                      type={field.type === "password" ? "password" : "text"}
                      value={formData[field.key] || ""}
                      onChange={(e) =>
                        handleFieldChange(field.key, e.target.value)
                      }
                      disabled={!canWrite || saving}
                      placeholder={
                        field.placeholder ||
                        `Enter ${String(field.label || "").toLowerCase()}`
                      }
                      required={field.required}
                      autoComplete={
                        field.type === "password" ? "new-password" : "off"
                      }
                    />
                    {field.key === "sipWsUrl" ? (
                      <div className="voip-modal__ws">
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost voip-modal__ws-btn"
                          onClick={handleDetectWs}
                          disabled={!canWrite || saving || detecting}
                        >
                          {detecting ? (
                            <Loader2 size={14} className="workspace-spin" />
                          ) : (
                            <Radar size={14} />
                          )}
                          {detecting ? "Scanning provider…" : "Detect automatically"}
                        </button>
                        <span className="voip-modal__ws-status" role="status">
                          {wsStatus ||
                            "Optional — leave empty and the endpoint is detected automatically."}
                        </span>
                      </div>
                    ) : null}
                    {field.hint ? (
                      <p className="voip-modal__hint">{field.hint}</p>
                    ) : null}
                  </div>
                )
              )}
              {advancedFields.length ? (
                <details
                  className="voip-modal__advanced"
                  open={advancedOpen}
                  onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
                >
                  <summary>
                    Advanced SIP settings
                    <span>
                      {provider.requiresHost
                        ? "Host required"
                        : "Server, port, WebSocket"}
                    </span>
                  </summary>
                  <div className="voip-modal__advanced-body">
                    {advancedFields.map((field) => (
                      <div key={field.key} className="voip-modal__field">
                        <label htmlFor={`voip-modal-${field.key}`}>
                          {field.label}
                          {field.required ? (
                            <span className="voip-required">*</span>
                          ) : null}
                        </label>
                        <input
                          id={`voip-modal-${field.key}`}
                          className="voip-modal__input"
                          type="text"
                          value={formData[field.key] || ""}
                          onChange={(e) =>
                            handleFieldChange(field.key, e.target.value)
                          }
                          disabled={!canWrite || saving}
                          placeholder={field.placeholder || ""}
                          autoComplete="off"
                        />
                        {field.key === "sipWsUrl" ? (
                          <div className="voip-modal__ws">
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost voip-modal__ws-btn"
                              onClick={handleDetectWs}
                              disabled={!canWrite || saving || detecting}
                            >
                              {detecting ? (
                                <Loader2 size={14} className="workspace-spin" />
                              ) : (
                                <Radar size={14} />
                              )}
                              {detecting ? "Scanning provider…" : "Detect automatically"}
                            </button>
                            <span className="voip-modal__ws-status" role="status">
                              {wsStatus ||
                                "Optional — leave empty and the endpoint is detected automatically."}
                            </span>
                          </div>
                        ) : null}
                        {field.hint ? (
                          <p className="voip-modal__hint">{field.hint}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          <footer className="voip-modal__footer">
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn--primary"
              disabled={!canWrite || saving}
            >
              {saving ? (
                <Loader2 className="workspace-spin" size={16} aria-hidden="true" />
              ) : null}
              {isEdit ? "Update & save" : "Save provider"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
