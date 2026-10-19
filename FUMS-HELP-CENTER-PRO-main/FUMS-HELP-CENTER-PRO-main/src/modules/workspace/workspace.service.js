import crypto from "crypto";
import prisma from "../../database/prisma/client.js";
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

export default {
    getWorkspaceProfile,
    updateWorkspaceProfile,
    generateWidgetApiKey
};
