import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
    ANNOUNCEMENT_LEVELS,
    ANNOUNCEMENT_SETTING_KEY,
    ANNOUNCEMENT_STATUSES,
    DEFAULT_ANNOUNCEMENT,
    DEFAULT_HOWTO,
    HOWTO_SETTING_KEY
} from "./platform-content.defaults.js";

function normalizeHowto(raw = {}) {
    return {
        title: String(raw.title || DEFAULT_HOWTO.title).trim() || DEFAULT_HOWTO.title,
        body: String(raw.body || DEFAULT_HOWTO.body).trim() || DEFAULT_HOWTO.body,
        videoUrl: String(raw.videoUrl || "").trim(),
        posterUrl:
            String(raw.posterUrl || DEFAULT_HOWTO.posterUrl).trim() ||
            DEFAULT_HOWTO.posterUrl,
        whatsNewUrl:
            String(raw.whatsNewUrl || DEFAULT_HOWTO.whatsNewUrl).trim() ||
            DEFAULT_HOWTO.whatsNewUrl
    };
}

export async function getHowtoContent() {
    try {
        const row = await prisma.platformSetting.findUnique({
            where: { key: HOWTO_SETTING_KEY }
        });
        if (!row?.value || typeof row.value !== "object") {
            return { ...DEFAULT_HOWTO };
        }
        return normalizeHowto(row.value);
    } catch {
        // Table may not exist yet before migrate — never break the shell.
        return { ...DEFAULT_HOWTO };
    }
}

export async function updateHowtoContent(payload, actedBy = null) {
    const next = normalizeHowto(payload);

    if (next.videoUrl && !/^https?:\/\//i.test(next.videoUrl) && !next.videoUrl.startsWith("/")) {
        throw new AppError("Video URL must be an http(s) link or a site path", 400);
    }
    if (
        next.posterUrl &&
        !/^https?:\/\//i.test(next.posterUrl) &&
        !next.posterUrl.startsWith("/")
    ) {
        throw new AppError("Poster URL must be an http(s) link or a site path", 400);
    }

    try {
        await prisma.platformSetting.upsert({
            where: { key: HOWTO_SETTING_KEY },
            create: {
                key: HOWTO_SETTING_KEY,
                value: next,
                updatedBy: actedBy || null
            },
            update: {
                value: next,
                updatedBy: actedBy || null
            }
        });
    } catch (error) {
        throw new AppError(
            error?.message ||
                "Unable to save howto settings. Run database migrations and try again.",
            503
        );
    }

    return next;
}

/* -------------------------------------------------------- Announcement */

function normalizeAnnouncement(raw = {}) {
    const asText = (value, max = 2000) => String(value ?? "").trim().slice(0, max);
    const level = ANNOUNCEMENT_LEVELS.includes(String(raw.level))
        ? String(raw.level)
        : DEFAULT_ANNOUNCEMENT.level;
    const status = ANNOUNCEMENT_STATUSES.includes(String(raw.status))
        ? String(raw.status)
        : DEFAULT_ANNOUNCEMENT.status;
    const title = asText(raw.title, 120);
    const body = asText(raw.body, 600);

    return {
        title,
        body,
        level,
        // An empty announcement can never stay published.
        status: title || body ? status : "draft",
        linkUrl: asText(raw.linkUrl, 400),
        linkLabel: asText(raw.linkLabel, 40),
        publishedAt: raw.publishedAt || null,
        updatedAt: raw.updatedAt || null
    };
}

export async function getAnnouncement() {
    try {
        const row = await prisma.platformSetting.findUnique({
            where: { key: ANNOUNCEMENT_SETTING_KEY }
        });
        if (!row?.value || typeof row.value !== "object" || Array.isArray(row.value)) {
            return { ...DEFAULT_ANNOUNCEMENT };
        }
        return normalizeAnnouncement(row.value);
    } catch {
        // Table missing before migrate — never break the portal.
        return { ...DEFAULT_ANNOUNCEMENT };
    }
}

export async function updateAnnouncement(payload = {}, actedBy = null) {
    const previous = await getAnnouncement();
    const next = normalizeAnnouncement({ ...previous, ...payload });

    if (next.status === "published" && !next.title) {
        throw new AppError("Add a title before publishing the announcement", 400);
    }

    if (
        next.linkUrl &&
        !/^https?:\/\//i.test(next.linkUrl) &&
        !next.linkUrl.startsWith("/")
    ) {
        throw new AppError("Link URL must be an http(s) link or a site path", 400);
    }

    const now = new Date().toISOString();
    next.publishedAt =
        next.status === "published" ? previous.publishedAt || now : null;
    next.updatedAt = now;

    try {
        await prisma.platformSetting.upsert({
            where: { key: ANNOUNCEMENT_SETTING_KEY },
            create: {
                key: ANNOUNCEMENT_SETTING_KEY,
                value: next,
                updatedBy: actedBy || null
            },
            update: { value: next, updatedBy: actedBy || null }
        });
    } catch (error) {
        throw new AppError(
            error?.message ||
                "Unable to save the announcement. Run database migrations and try again.",
            503
        );
    }

    return next;
}

/** The published announcement, or `null` when nothing is live. */
export async function getLiveAnnouncement() {
    const announcement = await getAnnouncement();
    if (announcement.status !== "published") return null;
    if (!announcement.title && !announcement.body) return null;
    return announcement;
}

