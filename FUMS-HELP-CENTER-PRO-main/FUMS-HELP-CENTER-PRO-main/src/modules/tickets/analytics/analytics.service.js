import prisma from "../../../database/prisma/client.js";
import { TICKET_CHANNEL, TICKET_STATUS } from "../ticket.constants.js";
import { requireTenantId } from "../helpers/tenant-scope.js";

const PERIODS = Object.freeze({
    "7d": { key: "7d", label: "Last 7 days", days: 7 },
    "30d": { key: "30d", label: "Last 30 days", days: 30 },
    "90d": { key: "90d", label: "Last 90 days", days: 90 }
});

const OPEN_STATUSES = [TICKET_STATUS.OPEN, TICKET_STATUS.QUEUED];
const PENDING_STATUSES = [TICKET_STATUS.PENDING, TICKET_STATUS.WAITING_FOR_REPLY];
const RESOLVED_STATUSES = [TICKET_STATUS.RESOLVED];
const CLOSED_STATUSES = [TICKET_STATUS.CLOSED];

function startOfUtcDay(date = new Date()) {
    return new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0
    ));
}

function addUtcDays(date, days) {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

function dayKey(dateValue) {
    return new Date(dateValue).toISOString().slice(0, 10);
}

function formatDayLabel(isoDay) {
    const d = new Date(`${isoDay}T00:00:00.000Z`);
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC"
    });
}

function percentChange(current, previous) {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 100);
}

function initialsFromName(name = "") {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "AG";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function resolvePeriod(periodKey = "7d") {
    const key = PERIODS[periodKey] ? periodKey : "7d";
    const meta = PERIODS[key];
    const endExclusive = addUtcDays(startOfUtcDay(), 1);
    const start = addUtcDays(endExclusive, -meta.days);
    const previousEnd = start;
    const previousStart = addUtcDays(previousEnd, -meta.days);
    return {
        ...meta,
        startsAt: start,
        endsAt: endExclusive,
        previousStartsAt: previousStart,
        previousEndsAt: previousEnd
    };
}

async function primaryChannelByTicketIds(ticketIds) {
    if (!ticketIds.length) return new Map();
    const events = await prisma.ticketEvent.findMany({
        where: {
            ticketId: { in: ticketIds },
            channel: {
                in: [TICKET_CHANNEL.EMAIL, TICKET_CHANNEL.CHAT, TICKET_CHANNEL.PHONE]
            }
        },
        orderBy: { createdAt: "asc" },
        select: { ticketId: true, channel: true }
    });
    const map = new Map();
    for (const event of events) {
        if (!map.has(event.ticketId)) map.set(event.ticketId, event.channel);
    }
    return map;
}

export async function getTicketAnalytics(tenantId, periodKey = "7d") {
    const scopedTenantId = requireTenantId({ tenantId });
    const period = resolvePeriod(periodKey);
    const tenantWhere = { tenantId: scopedTenantId };

    // Keep query count low for Render / shared Postgres pools.
    const [allTickets, resolvedHistory] = await Promise.all([
        prisma.ticket.findMany({
            where: tenantWhere,
            select: {
                id: true,
                status: true,
                priority: true,
                createdAt: true,
                assignedToUserId: true,
                assignedToName: true
            }
        }),
        prisma.ticketStatusHistory.findMany({
            where: {
                newStatus: TICKET_STATUS.RESOLVED,
                ticket: tenantWhere,
                createdAt: {
                    gte: period.previousStartsAt,
                    lt: period.endsAt
                }
            },
            select: {
                ticketRefId: true,
                createdAt: true,
                changedByUserId: true,
                changedByName: true
            }
        })
    ]);

    const inRange = (date, start, end) => {
        const t = new Date(date).getTime();
        return t >= start.getTime() && t < end.getTime();
    };

    const currentTickets = allTickets.filter((t) =>
        inRange(t.createdAt, period.startsAt, period.endsAt)
    );
    const previousTickets = allTickets.filter((t) =>
        inRange(t.createdAt, period.previousStartsAt, period.previousEndsAt)
    );

    const resolvedCurrent = resolvedHistory.filter((r) =>
        inRange(r.createdAt, period.startsAt, period.endsAt)
    );
    const resolvedPreviousCount = resolvedHistory.filter((r) =>
        inRange(r.createdAt, period.previousStartsAt, period.previousEndsAt)
    ).length;

    const totalCurrent = currentTickets.length;
    const totalPrevious = previousTickets.length;
    const openCurrent = currentTickets.filter((t) =>
        OPEN_STATUSES.includes(t.status)
    ).length;
    const openPrevious = previousTickets.filter((t) =>
        OPEN_STATUSES.includes(t.status)
    ).length;
    const resolvedCurrentCount = resolvedCurrent.length;
    const resolutionRateCurrent =
        totalCurrent > 0
            ? Math.round((resolvedCurrentCount / totalCurrent) * 100)
            : 0;
    const resolutionRatePrevious =
        totalPrevious > 0
            ? Math.round((resolvedPreviousCount / totalPrevious) * 100)
            : 0;

    const volumeMap = new Map();
    for (let i = 0; i < period.days; i += 1) {
        const day = addUtcDays(period.startsAt, i);
        const key = dayKey(day);
        volumeMap.set(key, { date: key, created: 0, resolved: 0, pending: 0 });
    }
    for (const ticket of currentTickets) {
        const key = dayKey(ticket.createdAt);
        const bucket = volumeMap.get(key);
        if (!bucket) continue;
        bucket.created += 1;
        if (PENDING_STATUSES.includes(ticket.status)) bucket.pending += 1;
    }
    for (const row of resolvedCurrent) {
        const key = dayKey(row.createdAt);
        const bucket = volumeMap.get(key);
        if (bucket) bucket.resolved += 1;
    }
    const volumeOverTime = [...volumeMap.values()].map((row) => ({
        ...row,
        label: formatDayLabel(row.date)
    }));

    const statusCounts = { open: 0, resolved: 0, closed: 0, pending: 0 };
    const priorityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const ticket of allTickets) {
        if (OPEN_STATUSES.includes(ticket.status)) statusCounts.open += 1;
        else if (RESOLVED_STATUSES.includes(ticket.status)) statusCounts.resolved += 1;
        else if (CLOSED_STATUSES.includes(ticket.status)) statusCounts.closed += 1;
        else if (PENDING_STATUSES.includes(ticket.status)) statusCounts.pending += 1;
        if (priorityCounts[ticket.priority] !== undefined) {
            priorityCounts[ticket.priority] += 1;
        }
    }

    const statusTotal =
        statusCounts.open +
        statusCounts.resolved +
        statusCounts.closed +
        statusCounts.pending;
    const statusBreakdown = [
        { key: "open", label: "Open", count: statusCounts.open, color: "#2E90FA" },
        { key: "resolved", label: "Resolved", count: statusCounts.resolved, color: "#12B76A" },
        { key: "closed", label: "Closed", count: statusCounts.closed, color: "#98A2B3" },
        { key: "pending", label: "Pending", count: statusCounts.pending, color: "#FDB022" }
    ].map((row) => ({
        ...row,
        percent: statusTotal > 0 ? Math.round((row.count / statusTotal) * 100) : 0
    }));

    const priorityTotal =
        priorityCounts.HIGH + priorityCounts.MEDIUM + priorityCounts.LOW;
    const priorityBreakdown = [
        { key: "HIGH", label: "High", count: priorityCounts.HIGH, color: "#F04438" },
        { key: "MEDIUM", label: "Medium", count: priorityCounts.MEDIUM, color: "#FDB022" },
        { key: "LOW", label: "Low", count: priorityCounts.LOW, color: "#12B76A" }
    ].map((row) => ({
        ...row,
        percent: priorityTotal > 0 ? Math.round((row.count / priorityTotal) * 100) : 0
    }));

    const channelMap = await primaryChannelByTicketIds(
        currentTickets.map((t) => t.id)
    );
    const channelCounts = { PHONE: 0, EMAIL: 0, CHAT: 0, MANUAL: 0 };
    for (const ticket of currentTickets) {
        const channel = channelMap.get(ticket.id) || "MANUAL";
        channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    }
    const channelTotal = Object.values(channelCounts).reduce((a, b) => a + b, 0);
    const channelBreakdown = [
        { key: "PHONE", label: "Call", color: "#12B76A" },
        { key: "EMAIL", label: "Email", color: "#7A5AF8" },
        { key: "CHAT", label: "Live chat", color: "#2E90FA" }
    ].map((row) => ({
        ...row,
        count: channelCounts[row.key] || 0,
        percent:
            channelTotal > 0
                ? Math.round(((channelCounts[row.key] || 0) / channelTotal) * 100)
                : 0
    }));

    const agentMap = new Map();
    for (const ticket of currentTickets) {
        if (!ticket.assignedToUserId) continue;
        const current = agentMap.get(ticket.assignedToUserId) || {
            userId: ticket.assignedToUserId,
            name: ticket.assignedToName || "Agent",
            total: 0,
            resolved: 0,
            open: 0,
            pending: 0
        };
        current.total += 1;
        if (ticket.assignedToName) current.name = ticket.assignedToName;
        if (
            RESOLVED_STATUSES.includes(ticket.status) ||
            CLOSED_STATUSES.includes(ticket.status)
        ) {
            current.resolved += 1;
        } else if (OPEN_STATUSES.includes(ticket.status)) {
            current.open += 1;
        } else if (PENDING_STATUSES.includes(ticket.status)) {
            current.pending += 1;
        }
        agentMap.set(ticket.assignedToUserId, current);
    }

    const topAgents = [...agentMap.values()]
        .map((agent) => ({
            ...agent,
            initials: initialsFromName(agent.name),
            resolutionRate:
                agent.total > 0
                    ? Math.round((agent.resolved / agent.total) * 100)
                    : 0
        }))
        .sort((a, b) => b.total - a.total || b.resolved - a.resolved)
        .slice(0, 8);

    return {
        generatedAt: new Date().toISOString(),
        period: {
            key: period.key,
            label: period.label,
            days: period.days,
            startsAt: period.startsAt.toISOString(),
            endsAt: period.endsAt.toISOString()
        },
        kpis: {
            totalTickets: {
                value: totalCurrent,
                changePercent: percentChange(totalCurrent, totalPrevious)
            },
            openTickets: {
                value: openCurrent,
                changePercent: percentChange(openCurrent, openPrevious)
            },
            resolved: {
                value: resolvedCurrentCount,
                changePercent: percentChange(
                    resolvedCurrentCount,
                    resolvedPreviousCount
                )
            },
            resolutionRate: {
                value: resolutionRateCurrent,
                changePercent: percentChange(
                    resolutionRateCurrent,
                    resolutionRatePrevious
                )
            }
        },
        volumeOverTime,
        statusBreakdown,
        channelBreakdown,
        priorityBreakdown,
        avgResolutionRate: resolutionRateCurrent,
        topAgents
    };
}

export default getTicketAnalytics;
