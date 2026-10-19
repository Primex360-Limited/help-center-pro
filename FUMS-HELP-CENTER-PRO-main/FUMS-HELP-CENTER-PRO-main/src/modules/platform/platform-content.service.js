import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { DEFAULT_HOWTO, HOWTO_SETTING_KEY } from "./platform-content.defaults.js";

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
