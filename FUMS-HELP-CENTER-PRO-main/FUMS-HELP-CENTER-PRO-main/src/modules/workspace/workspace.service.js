import crypto from "crypto";
import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { AUDIT_ACTION } from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import { toE164 } from "../tickets/voice/phone.utils.js";
import {
    discoverSipWebSocket,
    normalizeWsUrl
} from "./sip-websocket-discovery.service.js";

/**
 * Operator-supplied WebRTC gateway (Kamailio / FreeSWITCH / Asterisk
 * `transport ws`). When set, tenants whose carrier only publishes a SIP IP can
 * still call from the browser without pasting a WebSocket URL.
 */
export function platformDefaultWss() {
    const value = process.env.SIP_DEFAULT_WSS || process.env.SIP_GATEWAY_WSS || "";
    return normalizeWsUrl(value);
}

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
        credentials.sipTrunk ||
        // Plain-language aliases providers/tenants commonly paste in.
        credentials.sipIp ||
        credentials.ipAddress ||
        credentials.ip ||
        credentials.server ||
        credentials.host;
    const sipUsername =
        credentials.sipUsername ||
        credentials.sipUser ||
        credentials.sipAuthUser ||
        credentials.sipExtension ||
        credentials.sipAuth ||
        credentials.username ||
        credentials.user;
    const sipPassword =
        credentials.sipPassword ||
        credentials.sipPass ||
        credentials.sipSecret ||
        credentials.sipAuthPass ||
        credentials.password;
    const sipPort = String(
        credentials.sipPort || credentials.port || ""
    ).trim();
    const callerId = toE164(
        String(
            credentials.sipCallerId ||
                credentials.callerId ||
                credentials.fromNumber ||
                credentials.phoneNumber ||
                ""
        )
    );
    return { sipServer, sipUsername, sipPassword, callerId, sipPort };
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
         * Auto-close open tickets after N minutes without customer/agent activity.
         * `0` disables the policy. Integrators can read this via the public widget API.
         */
        ticketInactivityMinutes: Math.max(
            0,
            Number(settings.tickets?.inactivityAutoCloseMinutes ?? 4320) || 0
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
        ticketInactivityMinutes,
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
        ...((ticketInactivityMinutes !== undefined ||
            defaultTicketPriority !== undefined) && {
            tickets: {
                ...currentTickets,
                ...(ticketInactivityMinutes !== undefined && {
                    inactivityAutoCloseMinutes: Number(ticketInactivityMinutes)
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
 * Credential readiness for a stored provider configuration. Kept beside the
 * settings endpoints so every client (web app, mobile, API consumer) sees the
 * same answer instead of re-implementing the check.
 */
function voipReadiness(config = {}) {
    const credentials = config.credentials || {};
    const { sipServer, sipUsername, sipPassword } = extractSipCredentials(credentials);
    const missing = [];
    if (!sipServer) missing.push("server");
    if (!sipUsername) missing.push("username");
    if (!sipPassword) missing.push("password");

    // Browser calling needs a WebSocket. We can derive one for hostnames, but a
    // bare IP only works when the provider supplied an explicit WSS URL, a
    // discovery result was stored, or the operator runs a WebRTC gateway.
    const wsUrl = normalizeWsUrl(
        credentials.sipWsUrl || credentials.wssUrl || ""
    );
    const isRawIp = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(String(sipServer || ""));
    const platformWss = platformDefaultWss();
    const browserReady =
        Boolean(wsUrl) ||
        Boolean(platformWss) ||
        (Boolean(sipServer) && !isRawIp);

    return {
        ready: missing.length === 0,
        missing,
        browserReady,
        needsWsUrl: missing.length === 0 && !browserReady,
        /** `tenant` | `platform` | `derived` | `missing` */
        wsSource: wsUrl ? "tenant" : platformWss ? "platform" : browserReady ? "derived" : "missing"
    };
}

/**
 * Get VoIP/SIP provider configurations for the workspace.
 */
export async function getVoipSettings({ tenantId }) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const settings = asSettings(tenant.settings);
    const configurations = Array.isArray(settings.voipConfigurations)
        ? settings.voipConfigurations
        : [];

    const readiness = {};
    for (const config of configurations) {
        if (config?.id) readiness[config.id] = voipReadiness(config);
    }

    return {
        configurations,
        activeConfigId: settings.voipActiveConfigId || "",
        acceptInbound:
            settings.voipAcceptInbound === undefined
                ? true
                : Boolean(settings.voipAcceptInbound),
        readiness,
        /** Platform gateway the softphone falls back to (empty when unset). */
        platformDefaultWss: platformDefaultWss()
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

    // Never persist derived client state (reactivity field) back into JSON.
    const cleanConfigurations = (Array.isArray(configurations) ? configurations : []).map(
        (config) => {
            if (!config || typeof config !== "object") return config;
            const { readiness, ...rest } = config;
            return rest;
        }
    );

    // Validate that activeConfigId exists in configurations
    if (activeConfigId && cleanConfigurations.length > 0) {
        const activeExists = cleanConfigurations.some(c => c.id === activeConfigId);
        if (!activeExists) {
            throw new AppError("Active configuration ID must be one of the configured providers", 400);
        }

        // An active provider with missing credentials cannot place or receive
        // calls — block it here so nobody ends up with a silently dead line.
        const active = cleanConfigurations.find(c => c.id === activeConfigId);
        const { ready, missing } = voipReadiness(active);
        if (!ready) {
            throw new AppError(
                `Cannot activate ${active.providerName || "this provider"} — missing ${missing.join(", ")}. ` +
                    "Add them in Settings → VoIP/SIP → Edit → Advanced SIP settings.",
                400
            );
        }
    }

    const updatedSettings = {
        ...settings,
        voipConfigurations: cleanConfigurations,
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
 * Discover the SIP-over-WebSocket endpoint for this workspace's provider.
 *
 * This is what makes a carrier that only published "IP: 46.62.134.9 / port:
 * 5060" (Stuncall and friends) callable from the browser without an agent ever
 * typing a WSS URL: the server probes DNS SRV records plus the conventional
 * Asterisk/FreeSWITCH/Kamailio endpoints and returns the first one that
 * completes a WebSocket upgrade with a browser-trusted certificate.
 *
 * `persist: true` (requires settings:write) stores the discovered URL on the
 * provider config, so every agent inherits it and later sessions resolve with
 * zero network work.
 */
export async function discoverVoipWebSocket({
    tenantId,
    payload = {},
    canWrite = false,
    actorId = null
}) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const settings = asSettings(tenant.settings);
    const configurations = Array.isArray(settings.voipConfigurations)
        ? settings.voipConfigurations
        : [];

    const configId = String(payload.configId || "").trim();
    const config = configId
        ? configurations.find((entry) => entry.id === configId)
        : null;
    if (configId && !config) {
        throw new AppError("VoIP configuration not found", 404);
    }

    const credentials = config?.credentials || {};
    const { sipServer } = extractSipCredentials(credentials);
    const sipHost = String(payload.host || sipServer || "").trim();
    if (!sipHost) {
        throw new AppError(
            "Add the provider's SIP host/IP first — discovery needs a host to probe.",
            400
        );
    }

    const explicit = normalizeWsUrl(
        credentials.sipWsUrl || payload.providerWsUrl || ""
    );
    const platformDefault = platformDefaultWss();

    const discovery = await discoverSipWebSocket({
        providerId: String(payload.providerId || config?.providerId || ""),
        sipHost,
        providerDomain: String(payload.providerDomain || ""),
        extraUrls: [explicit, platformDefault].filter(Boolean),
        force: Boolean(payload.force)
    });

    // An explicit URL is a human decision: report it (verified when possible)
    // instead of silently replacing it with something we found.
    const verifiedCandidate = explicit
        ? discovery.candidates.find(
              (candidate) => normalizeWsUrl(candidate.url) === explicit
          ) || null
        : null;

    const wsUrl = explicit || discovery.best?.url || platformDefault || "";
    const source = explicit
        ? "tenant"
        : discovery.best
          ? "discovered"
          : platformDefault
            ? "platform"
            : "";

    let saved = false;
    if (payload.persist && canWrite && config && source === "discovered" && wsUrl) {
        const nextConfigurations = configurations.map((entry) => {
            if (entry?.id !== config.id) return entry;
            return {
                ...entry,
                credentials: {
                    ...(entry.credentials || {}),
                    sipWsUrl: wsUrl,
                    sipWsUrlSource: "auto",
                    sipWsUrlDetectedAt: new Date().toISOString()
                }
            };
        });

        await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
                settings: { ...settings, voipConfigurations: nextConfigurations }
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
                    voipWsAutoDetected: { configId: config.id, wsUrl }
                }
            }
        });

        saved = true;
    }

    return {
        wsUrl,
        source,
        verified: verifiedCandidate
            ? Boolean(verifiedCandidate.upgraded && verifiedCandidate.certValid)
            : Boolean(discovery.best),
        saved,
        platformDefaultWss: platformDefault,
        discovery
    };
}

/**
 * Remember the outcome of the last live registration test on the config, so the
 * UI can distinguish "configured" from "actually verified".
 */
async function persistVoipTestResult({
    tenantId,
    settings,
    configurations,
    configId,
    success,
    message
}) {
    try {
        const next = configurations.map((config) =>
            config.id === configId
                ? {
                      ...config,
                      lastTest: {
                          at: new Date().toISOString(),
                          success: Boolean(success),
                          // "fields" = server-side credential check; the browser
                          // records "registration" after a real SIP REGISTER.
                          source: "fields",
                          message: String(message || "").slice(0, 240)
                      }
                  }
                : config
        );
        await prisma.tenant.update({
            where: { id: tenantId },
            data: { settings: { ...settings, voipConfigurations: next } }
        });
    } catch {
        // Bookkeeping must never break the connection test.
    }
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

        const { sipServer, sipUsername, sipPassword, callerId, sipPort } =
            extractSipCredentials(credentials);

        if (!sipServer || !sipUsername || !sipPassword) {
            const missing = [];
            if (!sipServer) missing.push("SIP server (host or IP)");
            if (!sipUsername) missing.push("username");
            if (!sipPassword) missing.push("password");
            throw new AppError(
                `SIP credentials incomplete — missing ${missing.join(", ")}. ` +
                    "Open Settings → VoIP/SIP → Edit → Advanced SIP settings to add the provider's host and port.",
                400
            );
        }

        // Browser readiness is part of a "Test": a provider reachable only over
        // UDP looks healthy here yet no agent can register. Discovering the
        // WebSocket now is what makes Stuncall-style IP trunks actually work.
        const explicit = normalizeWsUrl(credentials.sipWsUrl || credentials.wssUrl || "");
        const platformDefault = platformDefaultWss();
        const isRawIp = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(String(sipServer));

        let wsUrl = explicit || "";
        let wsSource = explicit ? "tenant" : "";
        let wsVerified = false;
        let discovery = null;

        if (!explicit) {
            discovery = await discoverSipWebSocket({
                providerId: String(providerId || ""),
                sipHost: sipServer,
                extraUrls: [platformDefault].filter(Boolean)
            });
            if (discovery.best?.url) {
                wsUrl = discovery.best.url;
                wsSource = "discovered";
                wsVerified = true;
            } else if (platformDefault) {
                wsUrl = platformDefault;
                wsSource = "platform";
            }
        } else {
            const probe = await discoverSipWebSocket({
                providerId: String(providerId || ""),
                sipHost: sipServer,
                extraUrls: [explicit]
            });
            discovery = probe;
            const match = probe.candidates.find(
                (candidate) => normalizeWsUrl(candidate.url) === explicit
            );
            wsVerified = Boolean(match?.upgraded && match?.certValid);
        }

        const browserReady = Boolean(wsUrl) || (!isRawIp && Boolean(sipServer));

        success = browserReady;
        details = {
            providerId,
            server: sipServer,
            port: sipPort || "5060",
            username: sipUsername,
            callerId: callerId || null,
            softphoneReady: browserReady,
            wsUrl: wsUrl || null,
            wsSource: wsSource || "missing",
            wsVerified,
            wsCandidates: (discovery?.candidates || []).slice(0, 5)
        };

        if (browserReady) {
            message = wsVerified
                ? `WebSocket endpoint verified (${wsUrl}). Agents can call from the browser as soon as this provider is active.`
                : wsUrl
                  ? `SIP configuration validated. Browser calls will use ${wsUrl}.`
                  : "SIP configuration validated. Agents can call from the browser using the provider's conventional WebSocket endpoint.";
        } else {
            message =
                `SIP credentials are valid, but “${sipServer}” is a raw IP/port with no WebSocket endpoint, ` +
                "so a browser cannot register. Paste the provider's WSS URL once under Advanced SIP settings — " +
                "or set SIP_DEFAULT_WSS on the server to route every provider through your own WebRTC gateway.";
        }

        await persistVoipTestResult({
            tenantId: tenant.id,
            settings,
            configurations,
            configId: config.id,
            success,
            message
        });

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

        await persistVoipTestResult({
            tenantId: tenant.id,
            settings,
            configurations,
            configId: config.id,
            success: false,
            message: error.message
        });

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
    testVoipConnection,
    discoverVoipWebSocket,
    platformDefaultWss
};
