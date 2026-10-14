import { env } from "../config/env.js";
import { AppError } from "../shared/errors/AppError.js";
import { getServiceUrls } from "./serviceRegistry.js";

function buildHeaders(extra = {}) {
    const headers = {
        "content-type": "application/json",
        accept: "application/json",
        ...extra
    };

    if (env.INTERNAL_SERVICE_KEY && headers["x-internal-service-key"] === undefined) {
        headers["x-internal-service-key"] = env.INTERNAL_SERVICE_KEY;
    }

    for (const [key, value] of Object.entries(headers)) {
        if (value === undefined || value === null) {
            delete headers[key];
        }
    }

    return headers;
}

/**
 * Typed inter-service HTTP client. Used for notification dispatch and
 * gateway health aggregation — never for public browser traffic.
 */
export async function callService(baseUrl, path, { method = "GET", body, headers, timeoutMs = 15000 } = {}) {
    const url = `${String(baseUrl).replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method,
            headers: buildHeaders(headers),
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal
        });

        const text = await response.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = { raw: text };
            }
        }

        if (!response.ok) {
            const rawMessage = data?.message || data?.raw || "";
            const looksLikeHtml =
                typeof rawMessage === "string" &&
                (/<\s*!?\s*doctype|<\s*html|@font-face|Bad Gateway/i.test(rawMessage) ||
                    rawMessage.length > 300);
            throw new AppError(
                looksLikeHtml
                    ? `Upstream service error (${response.status})`
                    : data?.message || `Upstream service error (${response.status})`,
                response.status >= 400 && response.status < 600 ? response.status : 502
            );
        }

        return data;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        if (error?.name === "AbortError") {
            throw new AppError("Upstream service timed out", 504);
        }

        throw new AppError(error?.message || "Upstream service unreachable", 502);
    } finally {
        clearTimeout(timer);
    }
}

export async function sendEmailViaNotificationService(payload) {
    const { notification } = getServiceUrls();
    return callService(notification, "/internal/v1/email/send", {
        method: "POST",
        body: payload
    });
}

export async function probeServiceHealth(baseUrl) {
    try {
        // Free-tier Render cold starts often exceed 30s; keep health probes
        // short enough for the dashboard but long enough to wake neighbors.
        const data = await callService(baseUrl, "/health", {
            method: "GET",
            timeoutMs: 12000,
            headers: { "x-internal-service-key": undefined }
        });
        return { ok: true, data };
    } catch (error) {
        return {
            ok: false,
            error: error?.message || "unreachable"
        };
    }
}
