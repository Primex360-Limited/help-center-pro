import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";
import { getHowtoContent } from "../../api/platform.api.js";

const DEFAULT_HOWTO = {
  title: "How it works",
  body: "Check out the new dashboard view. Pages now load faster.",
  videoUrl: "",
  posterUrl: "/howto-video-poster.jpg",
  whatsNewUrl: "https://helpcentrepro.com",
};

function toEmbedUrl(url = "") {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}?autoplay=1&rel=0`;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      if (parsed.pathname.includes("/embed/")) {
        return `${parsed.origin}${parsed.pathname}?autoplay=1&rel=0`;
      }
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Premium sidebar "How it works" card — layout matches the dashboard mock:
 * title → copy → full-width video thumb with play → Dismiss | What's new?
 * Video URL is controlled by platform Super Admin only.
 */
export default function HowItWorksCard({ onDismiss }) {
  const [howto, setHowto] = useState(DEFAULT_HOWTO);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getHowtoContent();
        if (!cancelled && result?.data?.howto) {
          setHowto({ ...DEFAULT_HOWTO, ...result.data.howto });
        }
      } catch {
        /* keep defaults — poster still shows */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setPlaying(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [playing]);

  const poster = howto.posterUrl || DEFAULT_HOWTO.posterUrl;
  const embed = howto.videoUrl ? toEmbedUrl(howto.videoUrl) : null;
  const isDirectVideo = Boolean(
    howto.videoUrl && /\.(mp4|webm|ogg)(\?|$)/i.test(howto.videoUrl)
  );

  function handlePlay() {
    if (!howto.videoUrl) {
      window.open(howto.whatsNewUrl || DEFAULT_HOWTO.whatsNewUrl, "_blank", "noreferrer");
      return;
    }
    if (embed || isDirectVideo) {
      setPlaying(true);
      return;
    }
    window.open(howto.videoUrl, "_blank", "noreferrer");
  }

  const modal =
    playing &&
    createPortal(
      <div
        className="app-howto-modal"
        role="dialog"
        aria-modal="true"
        aria-label={howto.title}
        onClick={() => setPlaying(false)}
      >
        <div
          className="app-howto-modal__panel"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="app-howto-modal__close"
            onClick={() => setPlaying(false)}
            aria-label="Close video"
          >
            <X size={18} />
          </button>
          {embed ? (
            <iframe
              className="app-howto-modal__frame"
              src={embed}
              title={howto.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              className="app-howto-modal__frame"
              src={howto.videoUrl}
              controls
              autoPlay
              playsInline
            />
          )}
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <div className="app-howto">
        <p className="app-howto__title">{howto.title}</p>
        <p className="app-howto__copy">{howto.body}</p>

        <div className="app-howto__video">
          <button
            type="button"
            className="app-howto__thumb"
            onClick={handlePlay}
            aria-label="Play how it works video"
          >
            <img
              src={poster}
              alt=""
              draggable="false"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_HOWTO.posterUrl;
              }}
            />
            <span className="app-howto__play" aria-hidden="true">
              <Play size={13} fill="currentColor" strokeWidth={0} />
            </span>
          </button>
        </div>

        <div className="app-howto__links">
          <button type="button" className="app-howto__dismiss" onClick={onDismiss}>
            Dismiss
          </button>
          <a
            className="app-howto__link"
            href={howto.whatsNewUrl || DEFAULT_HOWTO.whatsNewUrl}
            target="_blank"
            rel="noreferrer"
          >
            What&apos;s new?
          </a>
        </div>
      </div>
      {modal}
    </>
  );
}
