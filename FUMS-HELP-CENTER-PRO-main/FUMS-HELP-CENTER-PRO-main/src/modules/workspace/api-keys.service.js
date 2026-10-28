import crypto from "crypto";
import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { AUDIT_ACTION } from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";

const MODES = Object.freeze(["test", "live"]);

function asSettings(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
}

function hashKey(raw) {
    return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

function keyPrefix(raw, visible = 12) {
    const value = String(raw);
    return `${value.slice(0, Math.min(visible, value.length))}…`;
}

function randomKeyBody(bytes = 24) {
    return crypto.randomBytes(bytes).toString("hex");
}

function buildKeyPair(mode) {
    if (mode === "test") {
        return {
            publicKey: `pk_test_${randomKeyBody()}`,
            secretKey: `sk_test_${randomKeyBody()}`
        };
    }
    return {
        publicKey: `pk_live_${randomKeyBody()}`,
        secretKey: `sk_live_${randomKeyBody()}`
    };
}

async function findWorkspaceOrFail(tenantId) {
    if (!tenantId) {
        throw new AppError(
            "A workspace is required to manage API keys",
            400
        );
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        throw new AppError("Workspace not found", 404);
    }
    return tenant;
}

function normalizeModeBucket(bucket = {}) {
    if (!bucket || typeof bucket !== "object") return null;
    if (!bucket.publicKeyPrefix && !bucket.secretKeyPrefix && !bucket.publicKeyHash) {
        return null;
    }
    return {
        publicKeyPrefix: bucket.publicKeyPrefix || null,
        secretKeyPrefix: bucket.secretKeyPrefix || null,
        updatedAt: bucket.updatedAt || null
    };
}

/**
 * Display-safe API key metadata (never returns hashes or full secrets).
 * Falls back to legacy `widgetApiKeyPrefix` under live when dual keys absent.
 */
export function buildApiKeysSummary(settings = {}) {
    const apiKeys = asSettings(settings).apiKeys || {};
    const test = normalizeModeBucket(apiKeys.test);
    let live = normalizeModeBucket(apiKeys.live);

    if (!live && settings.widgetApiKeyPrefix) {
        live = {
            publicKeyPrefix: null,
            secretKeyPrefix: settings.widgetApiKeyPrefix,
            updatedAt: settings.widgetApiKeyCreatedAt || null
        };
    }

    return {
        test: test || {
            publicKeyPrefix: null,
            secretKeyPrefix: null,
            updatedAt: null
        },
        live: live || {
            publicKeyPrefix: null,
            secretKeyPrefix: null,
            updatedAt: null
        }
    };
}

export async function getApiKeys({ tenantId }) {
    const tenant = await findWorkspaceOrFail(tenantId);
    return { apiKeys: buildApiKeysSummary(asSettings(tenant.settings)) };
}

export async function regenerateApiKeys({ tenantId, mode, actorId = null }) {
    const normalizedMode = String(mode || "").toLowerCase();
    if (!MODES.includes(normalizedMode)) {
        throw new AppError("mode must be test or live", 400);
    }

    const tenant = await findWorkspaceOrFail(tenantId);
    const settings = asSettings(tenant.settings);
    const { publicKey, secretKey } = buildKeyPair(normalizedMode);
    const now = new Date().toISOString();

    const modeBucket = {
        publicKeyPrefix: keyPrefix(publicKey),
        secretKeyPrefix: keyPrefix(secretKey),
        publicKeyHash: hashKey(publicKey),
        secretKeyHash: hashKey(secretKey),
        updatedAt: now
    };

    const apiKeys = {
        ...(settings.apiKeys && typeof settings.apiKeys === "object"
            ? settings.apiKeys
            : {}),
        [normalizedMode]: modeBucket
    };

    const updatedSettings = {
        ...settings,
        apiKeys
    };

    // Keep legacy live widget fields in sync so older embed paths still work.
    if (normalizedMode === "live") {
        updatedSettings.widgetApiKeyPrefix = modeBucket.secretKeyPrefix;
        updatedSettings.widgetApiKeyHash = modeBucket.secretKeyHash;
        updatedSettings.widgetApiKeyCreatedAt = now;
        updatedSettings.widgetApiKeyHint =
            "Embed the public key in your app chat widget. Use the secret key only on your server.";
    }

    await prisma.tenant.update({
        where: { id: tenant.id },
        data: { settings: updatedSettings }
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: actorId,
        action: AUDIT_ACTION.WORKSPACE_PROFILE_UPDATED,
        entity: "Tenant",
        entityId: tenant.id,
        metadata: {
            changes: { apiKeysRegenerated: true, mode: normalizedMode }
        }
    });

    return {
        mode: normalizedMode,
        publicKey,
        secretKey,
        message:
            "Store these keys now — the secret will not be shown again."
    };
}

/**
 * Resolve a raw API key (public or secret, test or live, or legacy hcp_live_*)
 * to a tenant + mode. Used by the public widget API.
 */
export async function resolveTenantByApiKey(rawKey) {
    const key = String(rawKey || "").trim();
    if (!key) {
        throw new AppError("API key is required", 401);
    }

    const digest = hashKey(key);

    const tenants = await prisma.tenant.findMany({
        where: {
            OR: [
                {
                    settings: {
                        path: ["apiKeys", "test", "publicKeyHash"],
                        equals: digest
                    }
                },
                {
                    settings: {
                        path: ["apiKeys", "test", "secretKeyHash"],
                        equals: digest
                    }
                },
                {
                    settings: {
                        path: ["apiKeys", "live", "publicKeyHash"],
                        equals: digest
                    }
                },
                {
                    settings: {
                        path: ["apiKeys", "live", "secretKeyHash"],
                        equals: digest
                    }
                },
                {
                    settings: {
                        path: ["widgetApiKeyHash"],
                        equals: digest
                    }
                }
            ]
        },
        take: 5
    });

    if (!tenants.length) {
        throw new AppError("Invalid API key", 401);
    }

    const tenant = tenants[0];
    const settings = asSettings(tenant.settings);
    const apiKeys = settings.apiKeys || {};

    let mode = "live";
    let keyKind = "public";
    if (
        apiKeys.test?.publicKeyHash === digest ||
        apiKeys.test?.secretKeyHash === digest
    ) {
        mode = "test";
    } else if (
        apiKeys.live?.publicKeyHash === digest ||
        apiKeys.live?.secretKeyHash === digest ||
        settings.widgetApiKeyHash === digest
    ) {
        mode = "live";
    }

    if (
        apiKeys.test?.secretKeyHash === digest ||
        apiKeys.live?.secretKeyHash === digest
    ) {
        keyKind = "secret";
    } else if (
        apiKeys.test?.publicKeyHash === digest ||
        apiKeys.live?.publicKeyHash === digest ||
        settings.widgetApiKeyHash === digest
    ) {
        keyKind = "public";
    } else if (key.startsWith("sk_")) {
        keyKind = "secret";
    }

    return { tenant, mode, settings, keyKind };
}

export function hashApiKey(raw) {
    return hashKey(raw);
}

export default {
    getApiKeys,
    regenerateApiKeys,
    resolveTenantByApiKey,
    buildApiKeysSummary,
    hashApiKey
};
