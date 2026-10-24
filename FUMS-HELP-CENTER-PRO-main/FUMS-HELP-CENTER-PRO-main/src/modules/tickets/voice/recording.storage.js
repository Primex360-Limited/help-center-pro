import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { AppError } from "../../../shared/errors/AppError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDINGS_ROOT = path.resolve(
    process.cwd(),
    "uploads",
    "call-recordings"
);

const DATA_URL_RE =
    /^data:(audio\/(?:webm|ogg|mpeg|mp4|wav|x-wav|aac)(?:;codecs=[^;]+)?)(;base64)?,([\s\S]+)$/i;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export function isLocalRecordingRef(value) {
    return typeof value === "string" && value.startsWith("local:");
}

export function localRefToRelative(ref) {
    return String(ref || "").replace(/^local:/, "");
}

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

/**
 * Persist a browser softphone recording (data URL) and return a local: ref.
 */
export async function saveCallRecordingDataUrl({
    tenantId,
    ticketId,
    callSid = null,
    dataUrl
}) {
    if (!dataUrl || typeof dataUrl !== "string") {
        throw new AppError("recordingDataUrl is required", 400);
    }

    const match = dataUrl.trim().match(DATA_URL_RE);
    if (!match) {
        throw new AppError(
            "Invalid recording data URL. Expected audio/webm, ogg, mpeg, mp4, or wav.",
            400
        );
    }

    const mime = match[1].toLowerCase();
    const isBase64 = Boolean(match[2]);
    const payload = match[3];
    const buffer = Buffer.from(
        payload.replace(/\s/g, ""),
        isBase64 ? "base64" : "utf8"
    );

    if (!buffer.length) {
        throw new AppError("Recording payload is empty", 400);
    }
    if (buffer.length > MAX_BYTES) {
        throw new AppError("Recording exceeds the 25 MB limit", 413);
    }

    const ext =
        mime.includes("webm")
            ? "webm"
            : mime.includes("ogg")
              ? "ogg"
              : mime.includes("mp4")
                ? "m4a"
                : mime.includes("mpeg") || mime.includes("mp3")
                  ? "mp3"
                  : "wav";

    const safeTenant = String(tenantId || "platform").replace(/[^\w-]/g, "_");
    const safeTicket = String(ticketId || "ticket").replace(/[^\w.-]/g, "_");
    const safeSid = String(callSid || Date.now()).replace(/[^\w.-]/g, "_");
    const filename = `${safeTicket}_${safeSid}.${ext}`;
    const dir = path.join(RECORDINGS_ROOT, safeTenant);
    await ensureDir(dir);

    const absolute = path.join(dir, filename);
    await fs.writeFile(absolute, buffer);

    const relative = path.join(safeTenant, filename).replace(/\\/g, "/");
    return {
        ref: `local:${relative}`,
        absolute,
        mime,
        bytes: buffer.length,
        filename
    };
}

/**
 * Resolve a local: recording ref to an absolute path (path-traversal safe).
 */
export async function resolveLocalRecording(ref) {
    if (!isLocalRecordingRef(ref)) {
        return null;
    }
    const relative = localRefToRelative(ref);
    const absolute = path.resolve(RECORDINGS_ROOT, relative);
    const rootResolved = path.resolve(RECORDINGS_ROOT);
    if (!absolute.startsWith(rootResolved + path.sep) && absolute !== rootResolved) {
        throw new AppError("Invalid recording path", 400);
    }
    try {
        await fs.access(absolute);
    } catch {
        throw new AppError("Recording file not found", 404);
    }
    return absolute;
}

export function contentTypeForPath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".webm") return "audio/webm";
    if (ext === ".ogg") return "audio/ogg";
    if (ext === ".m4a" || ext === ".mp4") return "audio/mp4";
    if (ext === ".mp3") return "audio/mpeg";
    if (ext === ".wav") return "audio/wav";
    return "application/octet-stream";
}

export { RECORDINGS_ROOT };
