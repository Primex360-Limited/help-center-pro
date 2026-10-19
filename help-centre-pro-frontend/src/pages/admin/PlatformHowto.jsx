import { useEffect, useState } from "react";
import { Play, Save } from "lucide-react";
import {
  getHowtoContent,
  updateHowtoContent,
} from "../../api/platform.api.js";
import "../../styles/admin.css";

const EMPTY = {
  title: "How it works",
  body: "Check out the new dashboard view. Pages now load faster.",
  videoUrl: "",
  posterUrl: "/howto-video-poster.jpg",
  whatsNewUrl: "https://helpcentrepro.com",
};

/**
 * Super Admin only (Admin Portal). Updates the tenant sidebar "How it works" video.
 * Tenant admins never see this screen.
 */
export default function PlatformHowto() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getHowtoContent();
        if (!cancelled) {
          setForm({ ...EMPTY, ...(result?.data?.howto || {}) });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load howto settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setBanner("");
    try {
      const result = await updateHowtoContent(form);
      setForm({ ...EMPTY, ...(result?.data?.howto || form) });
      setBanner("How it works video updated for all tenant workspaces.");
    } catch (err) {
      setError(err.message || "Unable to save");
    } finally {
      setSaving(false);
    }
  }

  function setField(key) {
    return (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  return (
    <div className="howto-admin">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">How it works video</h1>
          <p className="admin-kpi__meta">
            Platform Super Admin only — this video appears in every tenant sidebar.
            Tenant admins cannot change it.
          </p>
        </div>
      </div>

      {banner ? <p className="agents-banner" role="status">{banner}</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}
      {loading ? <p className="admin-empty">Loading…</p> : null}

      {!loading ? (
        <form className="admin-card howto-admin__form" onSubmit={handleSave}>
          <div className="howto-admin__preview">
            <div className="howto-admin__preview-card">
              <p className="app-howto__title">{form.title || "How it works"}</p>
              <p className="app-howto__copy">
                {form.body || "Check out the new dashboard view. Pages now load faster."}
              </p>
              <div className="app-howto__video">
                <div className="app-howto__thumb" aria-hidden="true">
                  <img
                    src={form.posterUrl || "/howto-video-poster.jpg"}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.src = "/howto-video-poster.jpg";
                    }}
                  />
                  <span className="app-howto__play">
                    <Play size={13} fill="currentColor" strokeWidth={0} />
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="admin-form" style={{ gap: 16 }}>
            <div>
              <label htmlFor="howto-title">Title</label>
              <input
                id="howto-title"
                value={form.title}
                onChange={setField("title")}
                required
              />
            </div>
            <div>
              <label htmlFor="howto-body">Description</label>
              <textarea
                id="howto-body"
                rows={3}
                value={form.body}
                onChange={setField("body")}
                required
              />
            </div>
            <div>
              <label htmlFor="howto-video">Video URL</label>
              <input
                id="howto-video"
                type="url"
                placeholder="https://www.youtube.com/watch?v=…"
                value={form.videoUrl}
                onChange={setField("videoUrl")}
              />
              <p className="admin-kpi__meta" style={{ marginTop: 6 }}>
                YouTube, Vimeo, or a direct MP4 link. Leave blank to open “What&apos;s new?” on play.
              </p>
            </div>
            <div>
              <label htmlFor="howto-poster">Poster image URL</label>
              <input
                id="howto-poster"
                placeholder="/howto-video-poster.jpg or https://…"
                value={form.posterUrl}
                onChange={setField("posterUrl")}
              />
            </div>
            <div>
              <label htmlFor="howto-whatsnew">What&apos;s new? link</label>
              <input
                id="howto-whatsnew"
                type="url"
                value={form.whatsNewUrl}
                onChange={setField("whatsNewUrl")}
              />
            </div>

            <div className="admin-form__actions">
              <button
                type="submit"
                className="admin-btn admin-btn--primary"
                disabled={saving}
              >
                <Save size={16} />
                {saving ? "Saving…" : "Save for all tenants"}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
