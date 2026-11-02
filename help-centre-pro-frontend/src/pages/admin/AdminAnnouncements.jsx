import { useCallback, useEffect, useMemo, useState } from "react";
import { Megaphone, Send, Trash2 } from "lucide-react";
import {
  getAnnouncement,
  updateAnnouncement,
} from "../../api/platform.api.js";
import {
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusPill,
  SuccessBanner,
} from "../../components/admin/ui.jsx";
import { formatDateTime } from "../../utils/currency.js";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

const EMPTY = {
  title: "",
  body: "",
  level: "info",
  linkUrl: "",
  linkLabel: "",
};

const LEVELS = [
  { value: "info", label: "Info", hint: "Neutral product news" },
  { value: "success", label: "Success", hint: "Launches and wins" },
  { value: "warning", label: "Warning", hint: "Maintenance windows" },
  { value: "critical", label: "Critical", hint: "Incidents and outages" },
];

const LEVEL_TONE = { info: "violet", success: "green", warning: "amber", critical: "red" };

function isSafeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  return /^https?:\/\//i.test(text) || text.startsWith("/");
}

export default function AdminAnnouncements() {
  const [form, setForm] = useState(EMPTY);
  const [meta, setMeta] = useState({ status: "draft", publishedAt: null, updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const hydrate = useCallback((announcement) => {
    const next = { ...EMPTY, ...(announcement || {}) };
    setForm({
      title: next.title || "",
      body: next.body || "",
      level: next.level || "info",
      linkUrl: next.linkUrl || "",
      linkLabel: next.linkLabel || "",
    });
    setMeta({
      status: next.status || "draft",
      publishedAt: next.publishedAt || null,
      updatedAt: next.updatedAt || null,
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAnnouncement();
      hydrate(result?.data?.announcement);
    } catch (err) {
      setError(err.message || "Unable to load the announcement");
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  useEffect(() => {
    load();
  }, [load]);

  const isPublished = meta.status === "published";
  const titleReady = Boolean(form.title.trim());
  const linkInvalid = !isSafeUrl(form.linkUrl);
  const published = isPublished && titleReady;

  const previewLevel = LEVEL_TONE[form.level] || "violet";

  function setField(key) {
    return (event) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function save(nextStatus) {
    setSaving(nextStatus);
    setError("");
    setNotice("");
    try {
      const result = await updateAnnouncement({ ...form, status: nextStatus });
      hydrate(result?.data?.announcement);
      setNotice(
        nextStatus === "published"
          ? "Published — the banner is live in every workspace and on the overview."
          : "Saved as draft — nothing is visible to tenants yet."
      );
    } catch (err) {
      setError(err.message || "Unable to save the announcement");
    } finally {
      setSaving("");
    }
  }

  const statusLabel = useMemo(() => {
    if (isPublished) return { status: "published", label: "Published" };
    return { status: "draft", label: "Draft" };
  }, [isPublished]);

  return (
    <div className="adm-page ann-page">
      <PageHeader
        title="Announcement"
        subtitle="Publish one message to every workspace sidebar and the platform overview."
      >
        <StatusPill status={statusLabel.status} label={statusLabel.label} variant="soft" />
        {meta.publishedAt ? (
          <span className="ov-updated">Live since {formatDateTime(meta.publishedAt)}</span>
        ) : null}
      </PageHeader>

      <ErrorBanner message={error} onRetry={load} />
      <SuccessBanner message={notice} />

      {loading ? (
        <div className="adm-card">
          <LoadingBlock label="Loading announcement…" />
        </div>
      ) : (
        <div className="ann-grid">
          <section className="adm-card ann-form">
            <h2 className="howto2__section-title">Message</h2>
            <p className="howto2__section-sub">
              Keep it to one idea. Every tenant admin and agent sees this in their sidebar.
            </p>

            <div className="howto2__field">
              <label htmlFor="ann-title">Title</label>
              <input
                id="ann-title"
                value={form.title}
                onChange={setField("title")}
                maxLength={120}
                placeholder="Scheduled maintenance — Sunday 02:00 UTC"
              />
              <div className="howto2__field-foot">
                <span>Required before publishing.</span>
                <span className="howto2__count">{form.title.length}/120</span>
              </div>
            </div>

            <div className="howto2__field">
              <label htmlFor="ann-body">Details</label>
              <textarea
                id="ann-body"
                rows={4}
                value={form.body}
                onChange={setField("body")}
                maxLength={600}
                placeholder="We'll roll out the new realtime layer between 02:00–02:30 UTC. Live chat may briefly reconnect."
              />
              <div className="howto2__field-foot">
                <span>Shown under the title — plain text.</span>
                <span className="howto2__count">{form.body.length}/600</span>
              </div>
            </div>

            <div className="howto2__field">
              <label htmlFor="ann-level">Severity</label>
              <select id="ann-level" value={form.level} onChange={setField("level")}>
                {LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label} — {level.hint}
                  </option>
                ))}
              </select>
            </div>

            <div className={`howto2__field${linkInvalid ? " has-error" : ""}`}>
              <label htmlFor="ann-link">Optional link</label>
              <input
                id="ann-link"
                type="url"
                inputMode="url"
                value={form.linkUrl}
                onChange={setField("linkUrl")}
                placeholder="https://status.helpcentrepro.com"
              />
              <div className="howto2__field-foot">
                <span>{linkInvalid ? "Use an https:// link or a site path." : "Status page, changelog, docs…"}</span>
              </div>
            </div>

            <div className="howto2__field">
              <label htmlFor="ann-link-label">Link label</label>
              <input
                id="ann-link-label"
                value={form.linkLabel}
                onChange={setField("linkLabel")}
                maxLength={40}
                placeholder="View status page"
              />
            </div>
          </section>

          <aside className="adm-card ann-preview">
            <div className="howto2__preview-head">
              <span className="howto2__eyebrow">Live preview</span>
              <Megaphone size={15} />
            </div>

            {previewLevel && (form.title || form.body) ? (
              <div className={`ann-card ann-card--${form.level}`}>
                <div className="ann-card__head">
                  <span className={`adm-pill adm-pill--${previewLevel}`}>
                    <span className="adm-pill__dot" aria-hidden="true" />
                    {form.level}
                  </span>
                  <span className="ann-card__time">
                    {meta.publishedAt ? formatDateTime(meta.publishedAt) : "Not published"}
                  </span>
                </div>
                <p className="ann-card__title">{form.title || "Untitled announcement"}</p>
                {form.body ? <p className="ann-card__body">{form.body}</p> : null}
                {form.linkUrl ? (
                  <span className="adm-link">
                    {form.linkLabel || "Learn more"} →
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="howto2__hint">
                Add a title to see exactly what tenants will get in their sidebar.
              </p>
            )}

            <ul className="ann-checklist">
              <li className={titleReady ? "is-done" : ""}>Title is set</li>
              <li className={form.body.trim() ? "is-done" : ""}>Details explain the impact</li>
              <li className={!linkInvalid ? "is-done" : ""}>Link is valid</li>
              <li className={published ? "is-done" : ""}>Published to all workspaces</li>
            </ul>

            <p className="howto2__hint">
              Announcements are stored once for the platform — no per-workspace copies, so
              edits are instant and auditable.
            </p>
          </aside>
        </div>
      )}

      {!loading ? (
        <div className="howto2__footer">
          <span className="howto2__footer-note">
            {linkInvalid
              ? "Fix the link URL to continue."
              : isPublished
                ? "Editing a published announcement updates it everywhere instantly."
                : "Drafts stay private until you publish."}
          </span>
          <div className="howto2__footer-actions">
            <button
              type="button"
              className="adm-btn adm-btn--outline"
              onClick={() => save("draft")}
              disabled={Boolean(saving)}
            >
              <Trash2 size={15} />
              {saving === "draft" ? "Saving…" : isPublished ? "Unpublish" : "Save draft"}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--primary"
              onClick={() => save("published")}
              disabled={Boolean(saving) || !titleReady || linkInvalid}
            >
              <Send size={15} />
              {saving === "published" ? "Publishing…" : "Publish now"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
