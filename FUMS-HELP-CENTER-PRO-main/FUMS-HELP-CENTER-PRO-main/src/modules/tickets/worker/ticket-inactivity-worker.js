import prisma from "../../../database/prisma/client.js";
import { TICKET_STATUS } from "../ticket.constants.js";

const OPEN_STATUSES = [
    TICKET_STATUS.QUEUED,
    TICKET_STATUS.OPEN,
    TICKET_STATUS.PENDING,
    TICKET_STATUS.WAITING_FOR_REPLY
];

const DEFAULT_HOURS = 72;
let timer = null;
let running = false;

function readInactivityHours(settings) {
    const tickets =
        settings && typeof settings === "object" && !Array.isArray(settings)
            ? settings.tickets || {}
            : {};
    const hours = Number(tickets.inactivityAutoCloseHours);
    if (!Number.isFinite(hours) || hours < 0) return DEFAULT_HOURS;
    return Math.floor(hours);
}

async function closeInactiveTicketsForTenant(tenant) {
    const hours = readInactivityHours(tenant.settings);
    if (hours <= 0) return 0;

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await prisma.ticket.updateMany({
        where: {
            tenantId: tenant.id,
            status: { in: OPEN_STATUSES },
            updatedAt: { lt: cutoff }
        },
        data: {
            status: TICKET_STATUS.RESOLVED,
            updatedAt: new Date(),
            updatedByUserId: "system:inactivity-worker",
            updatedByName: "Inactivity policy",
            updatedByEmail: "system@helpcentre.local"
        }
    });
    return result.count;
}

async function runInactivityCycle() {
    if (running) return;
    running = true;
    try {
        const tenants = await prisma.tenant.findMany({
            select: { id: true, settings: true, name: true }
        });
        let closed = 0;
        for (const tenant of tenants) {
            closed += await closeInactiveTicketsForTenant(tenant);
        }
        if (closed > 0) {
            console.log(`[Ticket inactivity] Auto-closed ${closed} idle ticket(s)`);
        }
    } catch (error) {
        console.error("[Ticket inactivity] cycle failed:", error?.message || error);
    } finally {
        running = false;
    }
}

export function startTicketInactivityWorker({
    intervalMs = 15 * 60 * 1000
} = {}) {
    if (timer) return;
    void runInactivityCycle();
    timer = setInterval(() => {
        void runInactivityCycle();
    }, intervalMs);
    if (typeof timer.unref === "function") timer.unref();
    console.log(
        `[Ticket inactivity] Worker started (every ${Math.round(intervalMs / 60000)} min)`
    );
}

export async function stopTicketInactivityWorker() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

export default {
    startTicketInactivityWorker,
    stopTicketInactivityWorker
};
