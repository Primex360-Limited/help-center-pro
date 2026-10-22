import crypto from "crypto";
import prisma from "../../database/prisma/client.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { AUDIT_ACTION } from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";

/**
 * Workspace (organisation) profile for tenant administrators.
 *
 * The `Tenant` row owns the display name; presentation-only fields such as the
 * logo and the workspace timezone live in the `Tenant.settings` JSON column so
 * no schema migration is needed to extend the profile later.
 */

function asSettings(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
}

function buildWorkspaceProfile(tenant) {
    const settings = asSettings(tenant.settings);

    return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        primaryDomain: tenant.primaryDomain || null,
        status: tenant.status,
        plan: tenant.plan || null,
        seatLimit: tenant.seatLimit ?? null,
        logoUrl: settings.logoUrl || null,
        timezone: settings.timezone || null,
        /** Tenant-connected mailbox used when agents send email from Help Centre Pro. */
        supportEmail: settings.supportEmail || null,
        supportEmailConnected: Boolean(settings.supportEmailConnected),
        /** Numbers provisioned by Help Centre Pro for this workspace. */
        callNumbers: Array.isArray(settings.callNumbers) ? settings.callNumbers : [],
        /** Calling line preference: HelpCentre Pro number vs tenant's own number. */
        calling: {
            mode: settings.calling?.mode === "own" ? "own" : "hcp",
            hcpPaused: Boolean(settings.calling?.hcpPaused),
            ownNumber: settings.calling?.ownNumber || null
        },
        /** Widget / chat integration — customers appear when the app uses this key. */
        widgetApiKeyPrefix: settings.widgetApiKeyPrefix || null,
        widgetApiKeyHint:
            settings.widgetApiKeyHint ||
            "Generate an API key and embed it in your app chat (same pattern as a live-agent widget).",
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
    };
}

async function findWorkspaceOrFail(tenantId) {
    if (!tenantId) {
        throw new AppError(
            "A workspace is required to manage organisation settings",
            400
        );
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

    if (!tenant) {
        throw new AppError("Workspace not found", 404);
    }

    return tenant;
}

export async function getWorkspaceProfile({ tenantId }) {
    const tenant = await findWorkspaceOrFail(tenantId);

    return { workspace: buildWorkspaceProfile(tenant) };
}

export async function updateWorkspaceProfile({
    tenantId,
    payload = {},
    actorId = null
}) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const { name, logoUrl, timezone, supportEmail } = payload;

    const updatedSettings = {
        ...asSettings(tenant.settings),
        ...(logoUrl !== undefined && { logoUrl: logoUrl.trim() || null }),
        ...(timezone !== undefined && { timezone: timezone.trim() }),
        ...(supportEmail !== undefined && {
            supportEmail: supportEmail.trim().toLowerCase() || null,
            supportEmailConnected: Boolean(supportEmail.trim()),
            supportEmailProvider: supportEmail.trim() ? "connected" : null
        })
    };

    const updatedTenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
            ...(name !== undefined && { name: name.trim() }),
            settings: updatedSettings
        }
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: actorId,
        action: AUDIT_ACTION.WORKSPACE_PROFILE_UPDATED,
        entity: "Tenant",
        entityId: tenant.id,
        metadata: {
            changes: {
                ...(name !== undefined && { name: name.trim() }),
                ...(timezone !== undefined && { timezone: timezone.trim() }),
                ...(logoUrl !== undefined && { logoUpdated: true }),
                ...(supportEmail !== undefined && {
                    supportEmailConnected: Boolean(String(supportEmail).trim())
                })
            }
        }
    });

    return { workspace: buildWorkspaceProfile(updatedTenant) };
}

/**
 * Generate a widget API key for the tenant's in-app live chat.
 * Customers created via the widget appear on tickets with customer snapshots.
 * The raw key is returned once; only a prefix is stored for display.
 */
export async function generateWidgetApiKey({ tenantId, actorId = null }) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const rawKey = `hcp_live_${crypto.randomBytes(24).toString("hex")}`;
    const prefix = `${rawKey.slice(0, 16)}…`;
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const updatedSettings = {
        ...asSettings(tenant.settings),
        widgetApiKeyPrefix: prefix,
        widgetApiKeyHash: hash,
        widgetApiKeyCreatedAt: new Date().toISOString(),
        widgetApiKeyHint:
            "Embed this key in your app chat widget. Customer identity flows into Help Centre Pro like a live-agent integration."
    };

    const updatedTenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: { settings: updatedSettings }
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: actorId,
        action: AUDIT_ACTION.WORKSPACE_PROFILE_UPDATED,
        entity: "Tenant",
        entityId: tenant.id,
        metadata: { changes: { widgetApiKeyRotated: true } }
    });

    return {
        workspace: buildWorkspaceProfile(updatedTenant),
        apiKey: rawKey,
        message:
            "Store this API key now — it will not be shown again. Use it in your app chat widget so customer details sync into Help Centre Pro."
    };
}

function isDemoPlaceholderNumber(e164) {
    return /^\+155501\d{2}$/.test(String(e164 || "").replace(/[\s()-]/g, ""));
}

/**
 * Generate (allocate) a HelpCentre Pro number for this workspace from the
 * platform Twilio pool. Idempotent — returns the existing active line.
 */
export async function generateCallNumber({ tenantId, actorId = null }) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const settings = asSettings(tenant.settings);
    const existing = (Array.isArray(settings.callNumbers)
        ? settings.callNumbers
        : []
    ).filter((n) => n?.e164 && !isDemoPlaceholderNumber(n.e164));

    const active = existing.find((n) => n.status !== "inactive");
    if (active) {
        return {
            workspace: buildWorkspaceProfile(tenant),
            number: active,
            message: "Your HelpCentre Pro number is already active."
        };
    }

    const poolNumber = String(env.TWILIO_PHONE_NUMBER || "").trim();
    if (!poolNumber || isDemoPlaceholderNumber(poolNumber)) {
        throw new AppError(
            "HelpCentre Pro number pool is empty. Set TWILIO_PHONE_NUMBER to a Twilio-owned number so workspaces can be provisioned.",
            503
        );
    }

    const number = {
        id: `num_${crypto.randomBytes(6).toString("hex")}`,
        e164: poolNumber,
        label: "Main support line",
        provisionedBy: "helpcentre_pro",
        status: "active",
        generatedAt: new Date().toISOString()
    };

    const updatedSettings = {
        ...settings,
        callNumbers: [...existing, number],
        calling: {
            mode: "hcp",
            hcpPaused: false,
            ownNumber: settings.calling?.ownNumber || null
        }
    };

    const updatedTenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: { settings: updatedSettings }
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: actorId,
        action: AUDIT_ACTION.WORKSPACE_PROFILE_UPDATED,
        entity: "Tenant",
        entityId: tenant.id,
        metadata: { changes: { callNumberGenerated: true } }
    });

    return {
        workspace: buildWorkspaceProfile(updatedTenant),
        number,
        message: "HelpCentre Pro number generated and active for outbound calls."
    };
}

/**
 * Pause/resume the HelpCentre Pro number, or switch to the tenant's
 * existing number as the outbound calling line.
 */
export async function updateCallingSettings({
    tenantId,
    payload = {},
    actorId = null
}) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const settings = asSettings(tenant.settings);
    const current = settings.calling || {};

    const calling = {
        mode:
            payload.mode !== undefined
                ? payload.mode
                : current.mode === "own"
                  ? "own"
                  : "hcp",
        hcpPaused:
            payload.hcpPaused !== undefined
                ? Boolean(payload.hcpPaused)
                : Boolean(current.hcpPaused),
        ownNumber:
            payload.ownNumber !== undefined
                ? payload.ownNumber
                  ? String(payload.ownNumber).trim()
                  : null
                : current.ownNumber || null
    };

    if (calling.mode === "own" && !calling.ownNumber) {
        throw new AppError(
            "Enter your existing phone number to use it as your calling line.",
            400
        );
    }
    if (calling.mode === "own") {
        calling.hcpPaused = true;
    }

    const updatedTenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
            settings: {
                ...settings,
                calling
            }
        }
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: actorId,
        action: AUDIT_ACTION.WORKSPACE_PROFILE_UPDATED,
        entity: "Tenant",
        entityId: tenant.id,
        metadata: { changes: { calling } }
    });

    return {
        workspace: buildWorkspaceProfile(updatedTenant),
        message:
            calling.mode === "own"
                ? "Your existing number is now your calling line. HelpCentre Pro number paused."
                : calling.hcpPaused
                  ? "HelpCentre Pro number paused."
                  : "HelpCentre Pro number is your calling line."
    };
}

export default {
    getWorkspaceProfile,
    updateWorkspaceProfile,
    generateWidgetApiKey,
    generateCallNumber,
    updateCallingSettings
};
