/** Default "How it works" sidebar content for every tenant. */
export const DEFAULT_HOWTO = Object.freeze({
    title: "How it works",
    body: "Check out the new dashboard view. Pages now load faster.",
    /** Empty = play opens the poster as a lightbox / what's-new link. */
    videoUrl: "",
    posterUrl: "/howto-video-poster.jpg",
    whatsNewUrl: "https://helpcentrepro.com"
});

export const HOWTO_SETTING_KEY = "tenant_sidebar_howto";

/**
 * Platform-wide announcement banner shown on the Admin Portal overview and in
 * every tenant workspace. Only `published` announcements are surfaced.
 */
export const DEFAULT_ANNOUNCEMENT = Object.freeze({
    title: "",
    body: "",
    /** info | success | warning | critical */
    level: "info",
    /** draft | published */
    status: "draft",
    linkUrl: "",
    linkLabel: "",
    publishedAt: null,
    updatedAt: null
});

export const ANNOUNCEMENT_SETTING_KEY = "platform.announcement";

export const ANNOUNCEMENT_LEVELS = Object.freeze(["info", "success", "warning", "critical"]);
export const ANNOUNCEMENT_STATUSES = Object.freeze(["draft", "published"]);
