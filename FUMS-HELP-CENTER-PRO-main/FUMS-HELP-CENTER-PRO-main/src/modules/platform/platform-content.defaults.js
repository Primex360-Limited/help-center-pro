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
