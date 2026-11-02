import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Play, RotateCcw, Save, Sparkles } from "lucide-react";
import { getHowtoContent, updateHowtoContent } from "../../api/platform.api.js";
import {
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  SuccessBanner,
} from "../../components/admin/ui.jsx";
import { formatDateTime } from "../../utils/currency.js";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

const EMPTY = {
  title: "How it works",
  body: "Check out the new dashboard view. Pages now load faster.",
  videoUrl: "",
  posterUrl: "/howto-video-poster.jpg",
  whatsNewUrl: "https://helpcentrepro.com",
};

const FIELDS = ["title", "body", "videoUrl", "posterUrl", "whatsNewUrl"];

function detectVideo(url) {
  const value = String(url || "").trim();
  if (!value) return { label: "Opens What's new", tone: "muted" };
  if (/youtu\.be|youtube\.com/i.test(value)) return { label: "YouTube", tone: "red" };
  if (/vimeo\.com/i.test(value)) return { label: "Vimeo", tone: "violet" };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(value)) return { label: "Direct video", tone: "green" };
  return { label: "External link", tone: "amber" };
}

function isSafeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  return /^https?:\/\//i.test(text) || text.startsWith("/");
}

function validate(form) {
  const errors = {};
  if (!String(form.title || "").trim()) errors.title = "Add a title for the sidebar card.";
  if (!String(form.body || "").trim()) errors.body = "Add a short description.";
  if (!isSafeUrl(form.videoUrl)) errors.videoUrl = "Use an https:// link or a site path.";
  if (!isSafeUrl(form.posterUrl)) errors.posterUrl = "Use an https:// link or a site path.";
  if (!isSafeUrl(form.whatsNewUrl)) errors.whatsNewUrl = "Use an https:// link.";
  return errors;
}

export default function PlatformHowto() {
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [posterBroken, setPosterBroken] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const applyResult = useCallback((howto) => {
    const next = { ...EMPTY, ...(howto || {}) };
    setForm(next);
    setSaved(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getHowtoContent();
      applyResult(result?.data?.howto);
    } catch (err) {
      setError(err.message || "Unable to load the How it works settings");
    } finally {
      setLoading(false);
    }
  }, [applyResult]);

  useEffect(() => {
    load();
  }, [load]);

  const errors = useMemo(() => validate(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = useMemo(
    () => FIELDS.some((key) => String(form[key] || "") !== String(saved[key] || "")),
    [form, saved]
  );

  const video = detectVideo(form.videoUrl);
  const playHref = String(form.videoUrl || "").trim() || String(form.whatsNewUrl || "").trim();

  function setField(key) {
    return (event) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
      if (key === "posterUrl") setPosterBroken(false);
      setNotice("");
    };
  }

  async function handleSave(event) {
    event.preventDefault();
    if (hasErrors) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await updateHowtoContent(form);
      applyResult(result?.data?.howto || form);
      setSavedAt(new Date());
      setNotice("Saved — every tenant workspace now shows this card.");
    } catch (err) {
      setError(err.message || "Unable to save the How it works video");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm({ ...EMPTY });
    setPosterBroken(false);
    setNotice("");
  }

  return (
    <div className="adm-page howto2">
      <PageHeader
        title="How it works video"
        subtitle="Platform Super Admin only — this card appears in every tenant workspace sidebar."
      >
        <a
          className="adm-btn adm-btn--outline"
          href={playHref || "#"}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={15} />
          Test link
        </a>
      </PageHeader>

      <ErrorBanner message={error} onRetry={load} />
      <SuccessBanner message={notice} />

      {loading ? (
        <div className="adm-card">
          <LoadingBlock label="Loading How it works settings…" />
        </div>
      ) : (
        <form className="howto2__grid" onSubmit={handleSave}>
          <aside className="adm-card howto2__preview">
            <div className="howto2__preview-head">
              <span className="howto2__eyebrow">Sidebar preview</span>
              <span className="howto2__pip" aria-hidden="true" />
            </div>

            <div className="howto2__card">
              <p className="howto2__card-title">{form.title || "How it works"}</p>
              <p className="howto2__card-copy">{form.body || "Add a short description."}</p>

              <div className="howto2__thumb">
                {posterBroken || !form.posterUrl ? (
                  <div className="howto2__thumb-fallback" aria-hidden="true">
                    <Sparkles size={22} />
                  </div>
                ) : (
                  <img src={form.posterUrl} alt="" onError={() => setPosterBroken(true)} />
                )}
                <span className="howto2__play">
                  <Play size={13} fill="currentColor" strokeWidth={0} />
                </span>
              </div>

              <div className="howto2__card-foot">
                <span className={`adm-pill adm-pill--${video.tone}`}>
                  <span className="adm-pill__dot" aria-hidden="true" />
                  {video.label}
                </span>
              </div>
            </div>

            <p className="howto2__hint">
              This is exactly how the card renders for tenant admins. Changes only reach
              workspaces after you save.
            </p>
          </aside>
          <section className="adm-card howto2__form">
            <div className="howto2__section">
              <h2 className="howto2__section-title">Card content</h2>
              <p className="howto2__section-sub">
                Shown above the video in the tenant sidebar. Keep it short and actionable.
              </p>

              <div className={`howto2__field${errors.title ? " has-error" : ""}`}>
                <label htmlFor="howto-title">Title</label>
                <input
                  id="howto-title"
                  value={form.title}
                  onChange={setField("title")}
                  maxLength={60}
                  placeholder="How it works"
                  required
                />
                <div className="howto2__field-foot">
                  <span>{errors.title || "Appears as the card heading."}</span>
                  <span className="howto2__count">{form.title.length}/60</span>
                </div>
              </div>

              <div className={`howto2__field${errors.body ? " has-error" : ""}`}>
                <label htmlFor="howto-body">Description</label>
                <textarea
                  id="howto-body"
                  rows={3}
                  value={form.body}
                  onChange={setField("body")}
                  maxLength={160}
                  placeholder="Check out the new dashboard view. Pages now load faster."
                  required
                />
                <div className="howto2__field-foot">
                  <span>{errors.body || "One or two lines — no marketing fluff."}</span>
                  <span className="howto2__count">{form.body.length}/160</span>
                </div>
              </div>
            </div>

            <div className="howto2__section">
              <h2 className="howto2__section-title">Media</h2>
              <p className="howto2__section-sub">
                YouTube, Vimeo or a direct MP4 link. Leave the video blank and the play button
                opens your What&apos;s new page instead.
              </p>

              <div className={`howto2__field${errors.videoUrl ? " has-error" : ""}`}>
                <label htmlFor="howto-video">Video URL</label>
                <div className="howto2__input-row">
                  <input
                    id="howto-video"
                    type="url"
                    inputMode="url"
                    placeholder="https://www.youtube.com/watch?v=…"
                    value={form.videoUrl}
                    onChange={setField("videoUrl")}
                  />
                  <span className={`adm-pill adm-pill--${video.tone}`}>
                    <span className="adm-pill__dot" aria-hidden="true" />
                    {video.label}
                  </span>
                </div>
                <div className="howto2__field-foot">
                  <span>{errors.videoUrl || "Detected automatically from the link."}</span>
                </div>
              </div>

              <div className={`howto2__field${errors.posterUrl ? " has-error" : ""}`}>
                <label htmlFor="howto-poster">Poster image URL</label>
                <input
                  id="howto-poster"
                  placeholder="/howto-video-poster.jpg or https://…"
                  value={form.posterUrl}
                  onChange={setField("posterUrl")}
                />
                <div className="howto2__field-foot">
                  <span>
                    {errors.posterUrl ||
                      (posterBroken
                        ? "That image could not be loaded — the gradient placeholder is shown."
                        : "16:9 image works best (JPG or PNG).")}
                  </span>
                </div>
              </div>

              <div className={`howto2__field${errors.whatsNewUrl ? " has-error" : ""}`}>
                <label htmlFor="howto-whatsnew">What&apos;s new link</label>
                <input
                  id="howto-whatsnew"
                  type="url"
                  inputMode="url"
                  value={form.whatsNewUrl}
                  onChange={setField("whatsNewUrl")}
                />
                <div className="howto2__field-foot">
                  <span>{errors.whatsNewUrl || "Where the play button leads when no video is set."}</span>
                </div>
              </div>
            </div>
          </section>
        </form>
      )}

      {!loading ? (
        <div className="howto2__footer">
          <span className="howto2__footer-note">
            {hasErrors
              ? "Fix the highlighted fields to save."
              : dirty
                ? "Unsaved changes"
                : savedAt
                  ? `Saved ${formatDateTime(savedAt)}`
                  : "All changes saved"}
          </span>
          <div className="howto2__footer-actions">
            <button
              type="button"
              className="adm-btn adm-btn--outline"
              onClick={handleReset}
              disabled={saving}
            >
              <RotateCcw size={15} />
              Reset fields
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--primary"
              onClick={handleSave}
              disabled={saving || hasErrors || !dirty}
            >
              <Save size={15} />
              {saving ? "Saving…" : "Save for all tenants"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
