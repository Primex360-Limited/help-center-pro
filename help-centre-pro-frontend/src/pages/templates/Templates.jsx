import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from "../../api/templates.api.js";
import { invalidateTemplateCache } from "../../components/tickets/TemplatePicker.jsx";
import "../../styles/templates.css";

const CATEGORIES = ["Greeting", "Resolution", "Follow-up", "General", "Escalation", "Billing"];

/** Message Templates — reusable responses with {{variables}}. */
export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null);
  const [search, setSearch] = useState("");

  const [dialog, setDialog] = useState(null); // { mode, template }
  const [form, setForm] = useState({ name: "", category: "Greeting", content: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await listTemplates();
      setTemplates(res?.data?.templates || []);
      setVariables(res?.data?.variables || []);
    } catch (err) {
      setError(err.message || "Unable to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!banner) return undefined;
    const t = setTimeout(() => setBanner(null), 4200);
    return () => clearTimeout(t);
  }, [banner]);

  function openCreate() {
    setForm({ name: "", category: "Greeting", content: "", isActive: true });
    setFormError("");
    setDialog({ mode: "create", template: null });
  }

  function openEdit(template) {
    setForm({
      name: template.name || "",
      category: template.category || "General",
      content: template.content || "",
      isActive: template.isActive !== false,
    });
    setFormError("");
    setDialog({ mode: "edit", template });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      setFormError("Give this template a name (at least 2 characters).");
      return;
    }
    if (!form.content.trim()) {
      setFormError("Template content cannot be empty.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (dialog.mode === "edit") {
        await updateTemplate(dialog.template.id, form);
        setBanner({ tone: "success", message: `"${form.name}" updated` });
      } else {
        await createTemplate(form);
        setBanner({ tone: "success", message: `"${form.name}" created` });
      }
      setDialog(null);
      invalidateTemplateCache();
      await load();
    } catch (err) {
      setFormError(err.message || "Unable to save this template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template) {
    if (!window.confirm(`Delete "${template.name}"? This cannot be undone.`)) return;
    setDeletingId(template.id);
    try {
      await deleteTemplate(template.id);
      setBanner({ tone: "success", message: `"${template.name}" deleted` });
      invalidateTemplateCache();
      await load();
    } catch (err) {
      setBanner({ tone: "error", message: err.message || "Unable to delete this template" });
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = templates.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      t.content?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="tpl-page">
      {banner ? (
        <div className={`tpl-toast tpl-toast--${banner.tone}`} role="status">
          {banner.tone === "error" ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          <span>{banner.message}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ) : null}

      <header className="tpl-head">
        <div>
          <h1>Message Templates</h1>
          <p>Create reusable response templates with variables</p>
        </div>
        <button type="button" className="tpl-btn-primary" onClick={openCreate}>
          <Plus size={15} /> Create New Template
        </button>
      </header>

      <div className="tpl-vars">
        <span>Available Variables</span>
        {variables.map((v) => (
          <code key={v.key} title={v.label}>
            {v.key}
          </code>
        ))}
        <label className="tpl-search">
          <Search size={14} />
          <input
            type="search"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <p className="tpl-loading">
          <Loader2 size={16} className="tpl-spin" /> Loading templates…
        </p>
      ) : error ? (
        <p className="tpl-error">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="tpl-empty">
          <h3>{templates.length === 0 ? "No templates yet" : "No templates match your search"}</h3>
          <p>Create your first reusable response to speed up agent replies.</p>
          <button type="button" className="tpl-btn-primary" onClick={openCreate}>
            <Plus size={15} /> Create New Template
          </button>
        </div>
      ) : (
        <div className="tpl-grid">
          {filtered.map((template) => (
            <article className="tpl-card" key={template.id}>
              <header className="tpl-card__head">
                <h3>{template.name}</h3>
                <span className={`tpl-active${template.isActive ? "" : " is-off"}`}>
                  {template.isActive ? "Active" : "Inactive"}
                </span>
              </header>
              <span className="tpl-card__category">{template.category}</span>
              <p className="tpl-card__content">{template.content}</p>
              <footer className="tpl-card__foot">
                <button type="button" className="tpl-edit-btn" onClick={() => openEdit(template)}>
                  <Pencil size={13} /> Edit Content
                </button>
                <button
                  type="button"
                  className="tpl-delete-btn"
                  onClick={() => handleDelete(template)}
                  disabled={deletingId === template.id}
                >
                  <Trash2 size={13} /> {deletingId === template.id ? "Deleting…" : "Delete"}
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {dialog ? (
        <div
          className="tpl-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tpl-dialog-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setDialog(null);
          }}
        >
          <div className="tpl-modal">
            <header className="tpl-modal__head">
              <h2 id="tpl-dialog-title">
                {dialog.mode === "edit" ? "Edit Template" : "New Template"}
              </h2>
              <button type="button" onClick={() => !saving && setDialog(null)} aria-label="Close">
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleSubmit}>
              {formError ? (
                <p className="tpl-error" role="alert">
                  {formError}
                </p>
              ) : null}

              <label className="tpl-field-label" htmlFor="tpl-name">
                Name
              </label>
              <input
                id="tpl-name"
                className="tpl-input"
                type="text"
                value={form.name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Welcome Reply"
                autoFocus
              />

              <label className="tpl-field-label" htmlFor="tpl-category">
                Category
              </label>
              <select
                id="tpl-category"
                className="tpl-input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label className="tpl-field-label" htmlFor="tpl-content">
                Content
              </label>
              <textarea
                id="tpl-content"
                className="tpl-textarea"
                rows={8}
                value={form.content}
                maxLength={5000}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder={"Hi {{customer_name}},\n\nThank you for reaching out…"}
              />

              <label className="tpl-toggle">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isActive}
                  className={`tpl-switch${form.isActive ? " is-on" : ""}`}
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                >
                  <span />
                </button>
                Active
              </label>

              <footer className="tpl-modal__foot">
                <button
                  type="button"
                  className="tpl-btn-cancel"
                  onClick={() => setDialog(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="tpl-btn-primary" disabled={saving}>
                  {saving
                    ? "Saving…"
                    : dialog.mode === "edit"
                      ? "Update Template"
                      : "Create Template"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
