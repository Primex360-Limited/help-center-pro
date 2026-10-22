import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";
import { listTemplates } from "../../api/templates.api.js";
import "../../styles/template-picker.css";

/**
 * Replace {{variables}} with real values. Unknown variables are left
 * untouched so an agent never sends a half-rendered template by accident
 * without seeing it first.
 */
export function renderTemplateContent(content, values = {}) {
  return String(content || "").replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (match, key) => {
    const value = values[key.toLowerCase()];
    return value === undefined || value === null || value === "" ? match : String(value);
  });
}

/**
 * Insert template text at the textarea cursor (never silently wipes a
 * draft the agent already typed). Falls back to appending when the
 * textarea is not mounted yet.
 */
export function applyTemplateInsert({ textarea, value, text, onChange }) {
  const current = value || "";
  if (!current.trim()) {
    onChange(text);
    requestAnimationFrame(() => textarea?.focus());
    return;
  }
  if (!textarea) {
    onChange(`${current.replace(/\s+$/, "")}\n\n${text}`);
    return;
  }
  const start = textarea.selectionStart ?? current.length;
  const end = textarea.selectionEnd ?? current.length;
  const before = current.slice(0, start);
  const after = current.slice(end);
  const prefix = before && !before.endsWith("\n") ? "\n" : "";
  const suffix = after && !after.startsWith("\n") ? "\n" : "";
  const next = `${before}${prefix}${text}${suffix}${after}`;
  onChange(next);
  const cursor = before.length + prefix.length + text.length;
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  });
}

/* Module-level cache: every composer on the page shares one fetch, and the
   Templates page invalidates it after any create/edit/delete. */
let cachedTemplates = null;
let cachePromise = null;

export function invalidateTemplateCache() {
  cachedTemplates = null;
  cachePromise = null;
}

async function fetchTemplates(force = false) {
  if (!force && cachedTemplates) return cachedTemplates;
  if (!force && cachePromise) return cachePromise;
  cachePromise = listTemplates()
    .then((res) => {
      cachedTemplates = res?.data?.templates || [];
      return cachedTemplates;
    })
    .finally(() => {
      cachePromise = null;
    });
  return cachePromise;
}

/**
 * Premium "Use Message Template" picker for ticket composers.
 * Loads the workspace's real templates, previews them with variables
 * already rendered for the current customer, and inserts at the cursor.
 */
export default function TemplatePicker({ values, onInsert, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState(cachedTemplates || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [insertedId, setInsertedId] = useState(null);
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  async function load(force = false) {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchTemplates(force);
      setTemplates(rows);
    } catch (err) {
      setError(err.message || "Unable to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    load();
    const t = setTimeout(() => searchRef.current?.focus(), 40);
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  const active = useMemo(
    () => templates.filter((t) => t.isActive !== false),
    [templates]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.content?.toLowerCase().includes(q)
    );
  }, [active, query]);

  function handlePick(template) {
    const rendered = renderTemplateContent(template.content, values);
    onInsert?.(rendered, template);
    setInsertedId(template.id);
    setTimeout(() => {
      setInsertedId(null);
      setOpen(false);
      setQuery("");
    }, 450);
  }

  return (
    <div className="tpk" ref={rootRef}>
      <button
        type="button"
        className={`tpk-trigger${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <FileText size={14} />
        Use Message Template
        <ChevronDown size={14} className={open ? "is-flipped" : ""} />
      </button>

      {open ? (
        <div className="tpk-pop" role="listbox" aria-label="Message templates">
          <div className="tpk-search">
            <Search size={14} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="tpk-icon-btn"
              onClick={() => load(true)}
              title="Refresh templates"
              aria-label="Refresh templates"
            >
              <RefreshCw size={13} className={loading ? "tpk-spin" : ""} />
            </button>
          </div>

          <div className="tpk-list">
            {loading && templates.length === 0 ? (
              <p className="tpk-state">
                <Loader2 size={15} className="tpk-spin" /> Loading templates…
              </p>
            ) : error ? (
              <div className="tpk-state tpk-state--error">
                <AlertCircle size={15} />
                <span>{error}</span>
                <button type="button" onClick={() => load(true)}>
                  Try again
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="tpk-state">
                {active.length === 0 ? (
                  <>
                    <FileText size={16} />
                    <span>No active templates yet. Create one and it will appear here instantly.</span>
                    <Link to="/templates" className="tpk-create-link" onClick={() => setOpen(false)}>
                      <Plus size={13} /> Create template
                    </Link>
                  </>
                ) : (
                  <span>No templates match “{query}”.</span>
                )}
              </div>
            ) : (
              filtered.map((template) => {
                const preview = renderTemplateContent(template.content, values);
                const inserted = insertedId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    role="option"
                    aria-selected={inserted}
                    className={`tpk-item${inserted ? " is-inserted" : ""}`}
                    onClick={() => handlePick(template)}
                  >
                    <span className="tpk-item__head">
                      <strong>{template.name}</strong>
                      <span className="tpk-item__cat">{template.category}</span>
                      {inserted ? (
                        <span className="tpk-item__check">
                          <Check size={13} /> Inserted
                        </span>
                      ) : null}
                    </span>
                    <span className="tpk-item__preview">{preview}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="tpk-foot">
            <span>
              {active.length} active template{active.length === 1 ? "" : "s"}
              {values?.customer_name ? ` · personalised for ${values.customer_name}` : ""}
            </span>
            <Link to="/templates" onClick={() => setOpen(false)}>
              <Settings2 size={13} /> Manage
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
