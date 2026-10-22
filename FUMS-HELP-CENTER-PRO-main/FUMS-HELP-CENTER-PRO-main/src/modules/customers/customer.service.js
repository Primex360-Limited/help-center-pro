import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";

/**
 * Customers are derived from real ticket customer snapshots — there is no
 * separate customer table, so every number shown in the UI is computed from
 * actual tickets and can never drift from reality.
 */

const OPEN_STATUSES = ["QUEUED", "OPEN", "PENDING", "WAITING_FOR_REPLY"];
const PENDING_STATUSES = ["QUEUED", "PENDING", "WAITING_FOR_REPLY"];

export function encodeCustomerKey(key) {
    return Buffer.from(key, "utf8").toString("base64url");
}

export function decodeCustomerKey(encoded) {
    try {
        return Buffer.from(String(encoded), "base64url").toString("utf8");
    } catch {
        return null;
    }
}

function identityKey(ticket) {
    const email = ticket.customerEmail?.trim().toLowerCase();
    if (email) return `email:${email}`;
    const phone = ticket.customerPhone?.trim();
    if (phone) return `phone:${phone}`;
    if (ticket.customerId) return `id:${ticket.customerId}`;
    const name = ticket.customerName?.trim().toLowerCase();
    if (name) return `name:${name}`;
    return null;
}

function summarize(tickets) {
    const sorted = [...tickets].sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    const latest = sorted[0];
    const counts = {
        total: tickets.length,
        open: tickets.filter((t) => t.status === "OPEN" || t.status === "QUEUED").length,
        resolved: tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length,
        pending: tickets.filter((t) => PENDING_STATUSES.includes(t.status)).length
    };

    return {
        latest,
        counts,
        lastSeenAt:
            tickets.reduce((max, t) => {
                const candidate = t.lastCustomerResponseAt || t.updatedAt;
                return candidate && (!max || candidate > max) ? candidate : max;
            }, null) || latest?.updatedAt || null
    };
}

function toCustomer(key, tickets) {
    const { latest, counts, lastSeenAt } = summarize(tickets);
    return {
        id: encodeCustomerKey(key),
        key,
        name: latest.customerName || latest.customerEmail || latest.customerPhone || "Unknown customer",
        email: latest.customerEmail || null,
        phone: latest.customerPhone || null,
        company: null,
        ticketCount: counts.total,
        openTickets: counts.open,
        isActive: tickets.some((t) => OPEN_STATUSES.includes(t.status)),
        lastSeenAt,
        createdAt: tickets.reduce(
            (min, t) => (!min || t.createdAt < min ? t.createdAt : min),
            null
        )
    };
}

async function loadGroupedCustomers() {
    const tickets = await prisma.ticket.findMany({
        select: {
            id: true,
            ticketId: true,
            title: true,
            status: true,
            priority: true,
            customerId: true,
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            createdAt: true,
            updatedAt: true,
            lastCustomerResponseAt: true,
            events: {
                select: { channel: true },
                orderBy: { createdAt: "asc" },
                take: 1
            }
        },
        orderBy: { updatedAt: "desc" }
    });

    const groups = new Map();
    for (const ticket of tickets) {
        const key = identityKey(ticket);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(ticket);
    }
    return groups;
}

export async function listCustomers() {
    const groups = await loadGroupedCustomers();
    const customers = [...groups.entries()]
        .map(([key, tickets]) => toCustomer(key, tickets))
        .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));

    return { customers, total: customers.length };
}

export async function getCustomerProfile(encodedKey) {
    const key = decodeCustomerKey(encodedKey);
    if (!key) throw new AppError("Invalid customer identifier", 400);

    const groups = await loadGroupedCustomers();
    const tickets = groups.get(key);
    if (!tickets?.length) throw new AppError("Customer not found", 404);

    const customer = toCustomer(key, tickets);
    const { counts } = summarize(tickets);

    return {
        customer: {
            ...customer,
            stats: {
                totalTickets: counts.total,
                open: counts.open,
                resolved: counts.resolved,
                pending: counts.pending
            }
        },
        tickets: [...tickets]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((t) => ({
                id: t.id,
                ticketId: t.ticketId,
                title: t.title,
                status: t.status,
                priority: t.priority,
                channel: t.events?.[0]?.channel || null,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt
            }))
    };
}

export default { listCustomers, getCustomerProfile };
