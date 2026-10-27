import crypto from "crypto";
import prisma from "../../database/prisma/client.js";
import {
    getTenantWebhookConfig,
    WEBHOOK_EVENTS
} from "../workspace/webhooks.service.js";

function asSettings(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
}

function signBody(body, secret) {
    return crypto
        .createHmac("sha256", secret)
        .update(body, "utf8")
        .digest("hex");
}

/**
 * Fire a tenant webhook asynchronously. Never throws to callers —
 * ticket create/status updates must not block on delivery failures.
 */
export function dispatchWebhook({ tenantId, event, payload }) {
    setImmediate(() => {
        deliverWebhook({ tenantId, event, payload }).catch((error) => {
            console.warn(
                `[webhook] ${event} delivery failed for tenant ${tenantId}:`,
                error?.message || error
            );
        });
    });
}

async function deliverWebhook({ tenantId, event, payload }) {
    if (!tenantId || !event) return;

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, slug: true, settings: true }
    });
    if (!tenant) return;

    const config = getTenantWebhookConfig(asSettings(tenant.settings));
    if (!config) return;
    if (!config.events?.[event]) return;

    const bodyObject = {
        id: `evt_${crypto.randomBytes(12).toString("hex")}`,
        type: event,
        createdAt: new Date().toISOString(),
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        data: payload
    };
    const body = JSON.stringify(bodyObject);
    const signature = signBody(body, config.signingSecret);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
        const response = await fetch(config.endpointUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-HCP-Signature": signature,
                "X-HCP-Event": event,
                "User-Agent": "HelpCentrePro-Webhooks/1.0"
            },
            body,
            signal: controller.signal
        });

        if (!response.ok) {
            console.warn(
                `[webhook] ${event} → ${config.endpointUrl} returned ${response.status}`
            );
        }
    } finally {
        clearTimeout(timeout);
    }
}

export function dispatchTicketCreatedWebhook(ticket) {
    if (!ticket?.tenantId) return;
    dispatchWebhook({
        tenantId: ticket.tenantId,
        event: WEBHOOK_EVENTS.TICKET_CREATED,
        payload: {
            ticketId: ticket.ticketId,
            id: ticket.id,
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
            customer: {
                customerId: ticket.customerId || ticket.customer?.customerId,
                name: ticket.customerName || ticket.customer?.name,
                email: ticket.customerEmail || ticket.customer?.email,
                phone: ticket.customerPhone || ticket.customer?.phone
            },
            createdAt: ticket.createdAt
        }
    });
}

export function dispatchTicketStatusUpdatedWebhook(ticket, previousStatus) {
    if (!ticket?.tenantId) return;
    const payload = {
        ticketId: ticket.ticketId,
        id: ticket.id,
        previousStatus,
        status: ticket.status,
        updatedAt: ticket.updatedAt
    };
    dispatchWebhook({
        tenantId: ticket.tenantId,
        event: WEBHOOK_EVENTS.TICKET_UPDATED,
        payload
    });
    // Legacy alias for early integrators
    dispatchWebhook({
        tenantId: ticket.tenantId,
        event: WEBHOOK_EVENTS.TICKET_STATUS_UPDATED,
        payload
    });
    if (String(ticket.status).toUpperCase() === "RESOLVED") {
        dispatchWebhook({
            tenantId: ticket.tenantId,
            event: WEBHOOK_EVENTS.TICKET_RESOLVED,
            payload
        });
    }
}

export function dispatchCustomerCreatedWebhook({ tenantId, customer }) {
    if (!tenantId || !customer?.customerId) return;
    dispatchWebhook({
        tenantId,
        event: WEBHOOK_EVENTS.CUSTOMER_CREATED,
        payload: {
            customerId: customer.customerId,
            name: customer.customerName || customer.name || null,
            email: customer.customerEmail || customer.email || null,
            phone: customer.customerPhone || customer.phone || null,
            createdAt: customer.createdAt || new Date().toISOString()
        }
    });
}

export default {
    dispatchWebhook,
    dispatchTicketCreatedWebhook,
    dispatchTicketStatusUpdatedWebhook,
    dispatchCustomerCreatedWebhook,
    WEBHOOK_EVENTS
};
