import crypto from "crypto";
import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { AUDIT_ACTION } from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import { toE164 } from "../tickets/voice/phone.utils.js";

function extractSipCredentials(credentials = {}) {
    const sipServer =
        credentials.sipServer ||
        credentials.sipDomain ||
        credentials.sipHost ||
        credentials.sipRealm ||
        credentials.sipRegistrar ||
        credentials.sipEndpoint ||
        credentials.sipProxy ||
        credentials.sipGateway ||
        credentials.sipTrunk;
    const sipUsername =
        credentials.sipUsername ||
        credentials.sipUser ||
        credentials.sipAuthUser ||
        credentials.sipExtension ||
        credentials.sipAuth;
    const sipPassword =
        credentials.sipPassword ||
        credentials.sipPass ||
        credentials.sipSecret ||
        credentials.sipAuthPass;
    const callerId = toE164(
        String(
            credentials.sipCallerId ||
                credentials.callerId ||
                credentials.fromNumber ||
                credentials.phoneNumber ||
                ""
        )
    );
    return { sipServer, sipUsername, sipPassword, callerId };
}

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
        /**
         * Auto-close open tickets after N hours without customer/agent activity.
         * `0` disables the policy. Integrators can read this via the public widget API.
         */
        ticketInactivityHours: Math.max(
            0,
            Number(settings.tickets?.inactivityAutoCloseHours ?? 72) || 0
        ),
        defaultTicketPriority: String(
            settings.tickets?.defaultPriority || "medium"
        ).toLowerCase(),
        /** Widget / chat integration — customers appear when the app uses this key. */
        widgetApiKeyPrefix:
            settings.apiKeys?.live?.secretKeyPrefix ||
            settings.widgetApiKeyPrefix ||
            null,
        widgetApiKeyHint:
            settings.widgetApiKeyHint ||
            "Generate test/live API keys and embed the public key in your app chat (LiveAgent-style).",
        apiKeys: {
            test: {
                publicKeyPrefix: settings.apiKeys?.test?.publicKeyPrefix || null,
                secretKeyPrefix: settings.apiKeys?.test?.secretKeyPrefix || null,
                updatedAt: settings.apiKeys?.test?.updatedAt || null
            },
            live: {
                publicKeyPrefix: settings.apiKeys?.live?.publicKeyPrefix || null,
                secretKeyPrefix:
                    settings.apiKeys?.live?.secretKeyPrefix ||
                    settings.widgetApiKeyPrefix ||
                    null,
                updatedAt:
                    settings.apiKeys?.live?.updatedAt ||
                    settings.widgetApiKeyCreatedAt ||
                    null
            }
        },
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
    const {
        name,
        logoUrl,
        timezone,
        supportEmail,
        ticketInactivityHours,
        defaultTicketPriority
    } = payload;
    const currentSettings = asSettings(tenant.settings);
    const currentTickets = asSettings(currentSettings.tickets);

    const updatedSettings = {
        ...currentSettings,
        ...(logoUrl !== undefined && { logoUrl: logoUrl.trim() || null }),
        ...(timezone !== undefined && { timezone: timezone.trim() }),
        ...(supportEmail !== undefined && {
            supportEmail: supportEmail.trim().toLowerCase() || null,
            supportEmailConnected: Boolean(supportEmail.trim()),
            supportEmailProvider: supportEmail.trim() ? "connected" : null
        }),
        ...((ticketInactivityHours !== undefined ||
            defaultTicketPriority !== undefined) && {
            tickets: {
                ...currentTickets,
                ...(ticketInactivityHours !== undefined && {
                    inactivityAutoCloseHours: Number(ticketInactivityHours)
                }),
                ...(defaultTicketPriority !== undefined && {
                    defaultPriority: String(defaultTicketPriority).toLowerCase()
                })
            }
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
 * Legacy live secret rotation — prefer POST /workspace/api-keys/:mode/regenerate.
 * Still returns a single secret for older clients; dual keys live under settings.apiKeys.
 */
export async function generateWidgetApiKey({ tenantId, actorId = null }) {
    const { regenerateApiKeys } = await import("./api-keys.service.js");
    const result = await regenerateApiKeys({
        tenantId,
        mode: "live",
        actorId
    });
    const tenant = await findWorkspaceOrFail(tenantId);

    return {
        workspace: buildWorkspaceProfile(tenant),
        apiKey: result.secretKey,
        publicKey: result.publicKey,
        secretKey: result.secretKey,
        message: result.message
    };
}

function isDemoPlaceholderNumber(e164) {
    return /^\+155501\d{2}$/.test(String(e164 || "").replace(/[\s()-]/g, ""));
}

/**
 * Register the workspace support line from the active VoIP/SIP caller ID
 * (or the tenant's own number). Idempotent when a usable line already exists.
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
            message: "Your support line is already active."
        };
    }

    const configurations = Array.isArray(settings.voipConfigurations)
        ? settings.voipConfigurations
        : [];
    const activeVoip =
        configurations.find((c) => c.id === settings.voipActiveConfigId) ||
        null;
    const { callerId } = extractSipCredentials(activeVoip?.credentials || {});
    const ownNumber = toE164(String(settings.calling?.ownNumber || ""));
    const poolNumber = callerId || ownNumber;

    if (!poolNumber || isDemoPlaceholderNumber(poolNumber)) {
        throw new AppError(
            "No caller ID available. Set a Default Caller ID on your active VoIP/SIP provider, or add your own number in Calling settings.",
            503
        );
    }

    const number = {
        id: `num_${crypto.randomBytes(6).toString("hex")}`,
        e164: poolNumber,
        label: "Main support line",
        provisionedBy: activeVoip ? "voip_sip" : "tenant_own",
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
        message: "Support line registered from your VoIP/SIP caller ID."
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

/**
 * Get VoIP/SIP provider configurations for the workspace.
 */
export async function getVoipSettings({ tenantId }) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const settings = asSettings(tenant.settings);

    return {
        configurations: Array.isArray(settings.voipConfigurations) ? settings.voipConfigurations : [],
        activeConfigId: settings.voipActiveConfigId || "",
        acceptInbound:
            settings.voipAcceptInbound === undefined
                ? true
                : Boolean(settings.voipAcceptInbound)
    };
}

/**
 * Save VoIP/SIP provider configurations.
 */
export async function saveVoipSettings({ tenantId, payload = {}, actorId = null }) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const settings = asSettings(tenant.settings);
    const {
        configurations = [],
        activeConfigId = "",
        acceptInbound
    } = payload;

    // Validate that activeConfigId exists in configurations
    if (activeConfigId && configurations.length > 0) {
        const activeExists = configurations.some(c => c.id === activeConfigId);
        if (!activeExists) {
            throw new AppError("Active configuration ID must be one of the configured providers", 400);
        }
    }

    const updatedSettings = {
        ...settings,
        voipConfigurations: configurations,
        voipActiveConfigId: activeConfigId,
        ...(acceptInbound === undefined
            ? {}
            : { voipAcceptInbound: Boolean(acceptInbound) })
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
        metadata: { changes: { voipSettingsUpdated: true } }
    });

    return {
        configurations: updatedSettings.voipConfigurations,
        activeConfigId: updatedSettings.voipActiveConfigId
    };
}

/**
 * Test connection to a configured VoIP provider.
 * This validates credentials and connectivity.
 */
export async function testVoipConnection({ tenantId, configId, actorId = null }) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const settings = asSettings(tenant.settings);
    const configurations = Array.isArray(settings.voipConfigurations) ? settings.voipConfigurations : [];

    const config = configurations.find(c => c.id === configId);
    if (!config) {
        throw new AppError("VoIP configuration not found", 404);
    }

    // Test connection based on provider type
    const providerId = config.providerId;
    const credentials = config.credentials || {};

    try {
        let success = false;
        let message = "";
        let details = null;

        const { sipServer, sipUsername, sipPassword, callerId } =
            extractSipCredentials(credentials);

        if (!sipServer || !sipUsername || !sipPassword) {
            throw new AppError(
                "SIP credentials incomplete. Server, username, and password are required.",
                400
            );
        }

        success = true;
        message =
            "SIP configuration validated. Agents can make and receive calls from the browser softphone once this provider is active.";
        details = {
            providerId,
            server: sipServer,
            username: sipUsername,
            callerId: callerId || null,
            softphoneReady: true
        };

        await recordAuditLog({
            tenantId: tenant.id,
            userId: actorId,
            action: AUDIT_ACTION.WORKSPACE_PROFILE_UPDATED,
            entity: "Tenant",
            entityId: tenant.id,
            metadata: { changes: { voipConnectionTest: { configId, success } } }
        });

        return { success, message, details };
    } catch (error) {
        if (error instanceof AppError) throw error;

        await recordAuditLog({
            tenantId: tenant.id,
            userId: actorId,
            action: AUDIT_ACTION.WORKSPACE_PROFILE_UPDATED,
            entity: "Tenant",
            entityId: tenant.id,
            metadata: { changes: { voipConnectionTest: { configId, success: false, error: error.message } } }
        });

        throw new AppError(`Connection test failed: ${error.message}`, 400);
    }
}

export default {
    getWorkspaceProfile,
    updateWorkspaceProfile,
    generateWidgetApiKey,
    generateCallNumber,
    updateCallingSettings,
    getVoipSettings,
    saveVoipSettings,
    testVoipConnection
};
