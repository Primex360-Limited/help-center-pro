import crypto from "crypto";
import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { AUDIT_ACTION } from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";

export const WEBHOOK_EVENTS = Object.freeze({
    TICKET_CREATED: "ticket.created",
    TICKET_UPDATED: "ticket.updated",
    TICKET_RESOLVED: "ticket.resolved",
    CUSTOMER_CREATED: "customer.created",
    /** @deprecated prefer ticket.updated */
    TICKET_STATUS_UPDATED: "ticket.status_updated"
});

const DEFAULT_EVENTS = Object.freeze({
    [WEBHOOK_EVENTS.TICKET_CREATED]: true,
    [WEBHOOK_EVENTS.TICKET_UPDATED]: true,
    [WEBHOOK_EVENTS.TICKET_RESOLVED]: false,
    [WEBHOOK_EVENTS.CUSTOMER_CREATED]: false
});

function asSettings(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
}

function normalizeEvents(events = {}) {
    const next = { ...DEFAULT_EVENTS };
    for (const key of Object.keys(DEFAULT_EVENTS)) {
        if (events[key] !== undefined) {
            next[key] = Boolean(events[key]);
        }
    }
    return next;
}

function buildWebhooksSummary(settings = {}, { includeSecret = false } = {}) {
    const webhooks = asSettings(settings).webhooks || {};
    return {
        endpointUrl: webhooks.endpointUrl || null,
        events: normalizeEvents(webhooks.events || {}),
        updatedAt: webhooks.updatedAt || null,
        hasSigningSecret: Boolean(webhooks.signingSecret),
        ...(includeSecret
            ? { signingSecret: webhooks.signingSecret || null }
            : {})
    };
}

async function findWorkspaceOrFail(tenantId) {
    if (!tenantId) {
        throw new AppError("A workspace is required to manage webhooks", 400);
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        throw new AppError("Workspace not found", 404);
    }
    return tenant;
}

export async function getWebhooks({ tenantId }) {
    const tenant = await findWorkspaceOrFail(tenantId);
    // Settings admins need the signing secret to configure receivers —
    // return it for authenticated workspace reads (same trust as regenerate).
    return {
        webhooks: buildWebhooksSummary(asSettings(tenant.settings), {
            includeSecret: true
        })
    };
}

export async function saveWebhooks({ tenantId, payload = {}, actorId = null }) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const settings = asSettings(tenant.settings);
    const current = settings.webhooks || {};

    let endpointUrl =
        payload.endpointUrl !== undefined
            ? String(payload.endpointUrl || "").trim() || null
            : current.endpointUrl || null;

    if (endpointUrl && !/^https?:\/\//i.test(endpointUrl)) {
        throw new AppError("endpointUrl must be an http(s) URL", 400);
    }

    let signingSecret =
        payload.signingSecret !== undefined
            ? String(payload.signingSecret || "").trim() || null
            : current.signingSecret || null;

    if (payload.generateSecret === true) {
        signingSecret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
    } else if (!signingSecret && endpointUrl) {
        signingSecret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
    }

    const webhooks = {
        endpointUrl,
        signingSecret,
        events: normalizeEvents(
            payload.events !== undefined ? payload.events : current.events
        ),
        updatedAt: new Date().toISOString()
    };

    await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
            settings: {
                ...settings,
                webhooks
            }
        }
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: actorId,
        action: AUDIT_ACTION.WORKSPACE_PROFILE_UPDATED,
        entity: "Tenant",
        entityId: tenant.id,
        metadata: { changes: { webhooksUpdated: true } }
    });

    return {
        webhooks: buildWebhooksSummary({ webhooks }, { includeSecret: true }),
        message: "Webhook settings saved"
    };
}

export function getTenantWebhookConfig(settings) {
    const webhooks = asSettings(settings).webhooks || {};
    if (!webhooks.endpointUrl || !webhooks.signingSecret) return null;
    return {
        endpointUrl: webhooks.endpointUrl,
        signingSecret: webhooks.signingSecret,
        events: normalizeEvents(webhooks.events || {})
    };
}

export default {
    getWebhooks,
    saveWebhooks,
    getTenantWebhookConfig,
    WEBHOOK_EVENTS
};
