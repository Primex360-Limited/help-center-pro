import { useEffect, useId, useMemo, useState } from "react";
import { ChevronRight, ExternalLink, Globe2, Search, X } from "lucide-react";
import {
  VOIP_PROVIDERS,
  PROVIDER_CATEGORIES,
  getProviderCount,
  primaryRegionLabel,
} from "../../constants/voipProviders.js";
import VoipProviderLogo from "./VoipProviderLogo.jsx";

/**
 * Premium catalog picker — shown only when "Add provider" is clicked.
 */
export default function VoipProviderPickerModal({
  canWrite = true,
  onClose,
  onSelect,
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const providers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return VOIP_PROVIDERS.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
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
  }, [query, category]);

  return (
    <div
      className="voip-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="voip-modal voip-modal--picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="voip-modal__header">
          <div>
            <p className="voip-modal__eyebrow">VoIP / SIP</p>
            <h2 id={titleId}>Choose a provider</h2>
            <p className="voip-modal__meta">
              {getProviderCount()} providers · credentials stay in your workspace
            </p>
          </div>
          <button
            type="button"
            className="voip-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="voip-modal__body voip-picker__body">
          <div className="voip-picker__filters">
            <label className="voip-picker__search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search providers…"
                aria-label="Search VoIP providers"
                autoFocus
              />
            </label>
            <select
              className="voip-picker__select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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

          {providers.length === 0 ? (
            <p className="voip-picker__empty">
              No providers match your search. Try another name or choose Custom SIP.
            </p>
          ) : (
            <div className="voip-picker__grid">
              {providers.map((item) => {
                const region = primaryRegionLabel(item.regions);
                const categoryLabel =
                  PROVIDER_CATEGORIES[item.category] || item.category || "SIP";
                const websiteUrl = String(item.website || "").trim();
                const href = websiteUrl
                  ? /^https?:\/\//i.test(websiteUrl)
                    ? websiteUrl
                    : `https://${websiteUrl}`
                  : "";
                return (
                  <div key={item.id} className="voip-picker__card-wrap">
                    <button
                      type="button"
                      className="voip-picker__card"
                      disabled={!canWrite}
                      onClick={() => onSelect?.(item.id)}
                      aria-label={`Configure ${item.name}`}
                    >
                      <VoipProviderLogo
                        name={item.name}
                        website={item.website}
                        domain={item.logoDomain}
                        size={48}
                      />
                      <div className="voip-picker__card-body">
                        <strong>{item.name}</strong>
                        <span>{categoryLabel}</span>
                        <span className="voip-picker__region">
                          <Globe2 size={12} aria-hidden="true" />
                          {region}
                        </span>
                        {href ? (
                          <span className="voip-picker__site" title={href}>
                            {href.replace(/^https?:\/\//i, "")}
                          </span>
                        ) : null}
                      </div>
                      <ChevronRight size={16} className="voip-picker__chevron" />
                    </button>
                    {href ? (
                      <a
                        className="voip-picker__visit"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        title={`Open ${item.name} website`}
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                        <span>Visit site</span>
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
