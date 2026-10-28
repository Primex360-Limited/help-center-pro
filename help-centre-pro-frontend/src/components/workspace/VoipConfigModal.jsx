import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import {
  getProviderById,
  PROVIDER_CATEGORIES,
  primaryRegionLabel,
} from "../../constants/voipProviders.js";
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
  if (credentials && typeof credentials === "object") {
    return { ...credentials };
  }
  const provider = getProviderById(providerId);
  const initial = {};
  uniqueFields([
    ...(provider?.authFields || []),
    ...(provider?.sipFields || []),
  ]).forEach((field) => {
    if (field.default !== undefined) initial[field.key] = field.default;
  });
  if (provider?.defaults?.dialOutPrefix && initial.dialOutPrefix === undefined) {
    initial.dialOutPrefix = provider.defaults.dialOutPrefix;
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

  useEffect(() => {
    setFormData(buildInitialForm(providerId, initialCredentials));
    setLocalError("");
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canWrite || saving || !provider) return;

    for (const field of allFields) {
      if (field.type === "checkbox") continue;
      if (field.required && !String(formData[field.key] || "").trim()) {
        setLocalError(`${field.label} is required`);
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

            {localError ? (
              <p className="voip-modal__error" role="alert">
                {localError}
              </p>
            ) : null}

            <div className="voip-modal__fields">
              <h3>{provider.simpleSetup ? "Account details" : "SIP configuration"}</h3>
              {sipFields.map((field) =>
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
                    {field.hint ? (
                      <p className="voip-modal__hint">{field.hint}</p>
                    ) : null}
                  </div>
                )
              )}
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
