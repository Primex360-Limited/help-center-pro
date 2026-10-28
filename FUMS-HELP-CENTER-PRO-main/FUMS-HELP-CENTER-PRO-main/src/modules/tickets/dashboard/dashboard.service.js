import prisma from "../../../database/prisma/client.js";
import { TICKET_CHANNEL, TICKET_STATUS } from "../ticket.constants.js";
import { requireTenantId } from "../helpers/tenant-scope.js";

const CHANNEL_LABELS = Object.freeze({
    EMAIL: "Emails",
    CHAT: "Chat",
    PHONE: "Call",
    MANUAL: "Manual"
});

const OPEN_STATUSES = [TICKET_STATUS.OPEN, TICKET_STATUS.QUEUED];
const PENDING_STATUSES = [TICKET_STATUS.PENDING, TICKET_STATUS.WAITING_FOR_REPLY];
const ACTIVE_STATUSES = [
    TICKET_STATUS.OPEN,
    TICKET_STATUS.QUEUED,
    TICKET_STATUS.PENDING,
    TICKET_STATUS.WAITING_FOR_REPLY
];

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

function daysAgoStart(days) {
    const start = startOfUtcDay();
    start.setUTCDate(start.getUTCDate() - (days - 1));
    return start;
}

function formatRelativeTime(dateValue) {
    const date = new Date(dateValue);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
}

function initialsFromName(name = "") {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "AG";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function channelLabel(channel) {
    return CHANNEL_LABELS[channel] || CHANNEL_LABELS.MANUAL;
}

function emptyChannelBucket() {
    return {
        EMAIL: 0,
        CHAT: 0,
        PHONE: 0,
        MANUAL: 0
    };
}

function metricOption(key, label, value) {
    return { key, label, value };
}

async function getPrimaryChannelsByTicketIds(ticketIds) {
    if (!ticketIds.length) return new Map();

    const events = await prisma.ticketEvent.findMany({
        where: {
            ticketId: { in: ticketIds },
            channel: { in: [TICKET_CHANNEL.EMAIL, TICKET_CHANNEL.CHAT, TICKET_CHANNEL.PHONE] }
        },
        orderBy: { createdAt: "asc" },
        select: {
            ticketId: true,
            channel: true
        }
    });

    const map = new Map();
    for (const event of events) {
        if (!map.has(event.ticketId)) {
            map.set(event.ticketId, event.channel);
        }
    }
    return map;
}

async function countDistinctCustomers(tenantWhere, createdAtGte = null) {
    const where = {
        ...tenantWhere,
        ...(createdAtGte ? { createdAt: { gte: createdAtGte } } : {})
    };

    const [emailGroups, idGroups] = await Promise.all([
        prisma.ticket.groupBy({
            by: ["customerEmail"],
            where: { ...where, customerEmail: { not: null } },
            _count: { _all: true }
        }),
        prisma.ticket.groupBy({
            by: ["customerId"],
            where: {
                ...where,
                customerId: { not: null },
                customerEmail: null
            },
            _count: { _all: true }
        })
    ]);

    const unique = new Set();
    for (const group of emailGroups) {
        if (group.customerEmail) unique.add(group.customerEmail.toLowerCase());
    }
    for (const group of idGroups) {
        if (group.customerId) unique.add(`id:${group.customerId}`);
    }
    return unique.size;
}

async function countResolvedSince(tenantWhere, since = null) {
    return prisma.ticketStatusHistory.count({
        where: {
            newStatus: TICKET_STATUS.RESOLVED,
            ...(since ? { createdAt: { gte: since } } : {}),
            ticket: tenantWhere
        }
    });
}

async function countActiveAgents(tenantWhere, createdAtGte = null) {
    if (!createdAtGte) {
        const groups = await prisma.ticket.groupBy({
            by: ["assignedToUserId"],
            where: {
                ...tenantWhere,
                assignedToUserId: { not: null },
                status: { in: ACTIVE_STATUSES }
            },
            _count: { _all: true }
        });
        return groups.length;
    }

    const rows = await prisma.ticketStatusHistory.findMany({
        where: {
            newStatus: TICKET_STATUS.RESOLVED,
            createdAt: { gte: createdAtGte },
            ticket: tenantWhere,
            changedByUserId: { not: null }
        },
        select: { changedByUserId: true },
        distinct: ["changedByUserId"]
    });
    return rows.length;
}

export async function getDashboardOverview(tenantId) {
    const scopedTenantId = requireTenantId({ tenantId });
    const todayStart = startOfUtcDay();
    const weekStart = daysAgoStart(7);
    const monthStart = daysAgoStart(30);
    const tenantWhere = { tenantId: scopedTenantId };

    const [
        openLive,
        openToday,
        open7d,
        open30d,
        pendingLive,
        pendingToday,
        pending7d,
        pending30d,
        resolvedToday,
        resolved7d,
        resolved30d,
        resolvedAll,
        customersAll,
        customers30d,
        customers7d,
        customersToday,
        agentsLive,
        agentsToday,
        agents7d,
        ticketsCreatedToday,
        recentTickets,
        resolvedTodayRows
    ] = await Promise.all([
        prisma.ticket.count({
            where: { ...tenantWhere, status: { in: OPEN_STATUSES } }
        }),
        prisma.ticket.count({
            where: {
                ...tenantWhere,
                status: { in: OPEN_STATUSES },
                createdAt: { gte: todayStart }
            }
        }),
        prisma.ticket.count({
            where: {
                ...tenantWhere,
                status: { in: OPEN_STATUSES },
                createdAt: { gte: weekStart }
            }
        }),
        prisma.ticket.count({
            where: {
                ...tenantWhere,
                status: { in: OPEN_STATUSES },
                createdAt: { gte: monthStart }
            }
        }),
        prisma.ticket.count({
            where: { ...tenantWhere, status: { in: PENDING_STATUSES } }
        }),
        prisma.ticket.count({
            where: {
                ...tenantWhere,
                status: { in: PENDING_STATUSES },
                createdAt: { gte: todayStart }
            }
        }),
        prisma.ticket.count({
            where: {
                ...tenantWhere,
                status: { in: PENDING_STATUSES },
                createdAt: { gte: weekStart }
            }
        }),
        prisma.ticket.count({
            where: {
                ...tenantWhere,
                status: { in: PENDING_STATUSES },
                createdAt: { gte: monthStart }
            }
        }),
        countResolvedSince(tenantWhere, todayStart),
        countResolvedSince(tenantWhere, weekStart),
        countResolvedSince(tenantWhere, monthStart),
        countResolvedSince(tenantWhere, null),
        countDistinctCustomers(tenantWhere),
        countDistinctCustomers(tenantWhere, monthStart),
        countDistinctCustomers(tenantWhere, weekStart),
        countDistinctCustomers(tenantWhere, todayStart),
        countActiveAgents(tenantWhere),
        countActiveAgents(tenantWhere, todayStart),
        countActiveAgents(tenantWhere, weekStart),
        prisma.ticket.findMany({
            where: { ...tenantWhere, createdAt: { gte: todayStart } },
            select: { id: true }
        }),
        prisma.ticket.findMany({
            where: tenantWhere,
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
                id: true,
                ticketId: true,
                title: true,
                status: true,
                priority: true,
                createdAt: true,
                customerName: true,
                assignedToName: true,
                createdByName: true
            }
        }),
        prisma.ticketStatusHistory.findMany({
            where: {
                newStatus: TICKET_STATUS.RESOLVED,
                createdAt: { gte: todayStart },
                ticket: tenantWhere
            },
            select: {
                ticketRefId: true,
                changedByUserId: true,
                changedByName: true
            }
        })
    ]);

    const resolvedTicketIds = [...new Set(resolvedTodayRows.map((row) => row.ticketRefId))];
    const resolvedTodayDetails = resolvedTicketIds.length
        ? await prisma.ticket.findMany({
            where: { ...tenantWhere, id: { in: resolvedTicketIds } },
            select: {
                id: true,
                assignedToUserId: true,
                assignedToName: true
            }
        })
        : [];

    const createdTodayIds = ticketsCreatedToday.map((ticket) => ticket.id);
    const recentIds = recentTickets.map((ticket) => ticket.id);
    const channelMap = await getPrimaryChannelsByTicketIds([
        ...new Set([...createdTodayIds, ...recentIds, ...resolvedTicketIds])
    ]);

    const createdByChannel = emptyChannelBucket();
    for (const ticketId of createdTodayIds) {
        const channel = channelMap.get(ticketId) || "MANUAL";
        createdByChannel[channel] += 1;
    }

    const resolvedByChannel = emptyChannelBucket();
    for (const ticketId of resolvedTicketIds) {
        const channel = channelMap.get(ticketId) || "MANUAL";
        resolvedByChannel[channel] += 1;
    }

    const agentScoreMap = new Map();
    const resolvedTicketById = new Map(
        resolvedTodayDetails.map((ticket) => [ticket.id, ticket])
    );

    for (const row of resolvedTodayRows) {
        const ticket = resolvedTicketById.get(row.ticketRefId);
        const userId = ticket?.assignedToUserId || row.changedByUserId;
        const name = ticket?.assignedToName || row.changedByName || "Unassigned";
        if (!userId) continue;

        const current = agentScoreMap.get(userId) || {
            userId,
            name,
            score: 0
        };
        current.score += 1;
        if (ticket?.assignedToName) current.name = ticket.assignedToName;
        agentScoreMap.set(userId, current);
    }

    const topAgents = [...agentScoreMap.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((agent, index) => ({
            rank: index + 1,
            userId: agent.userId,
            name: agent.name,
            score: agent.score,
            initials: initialsFromName(agent.name)
        }));

    const maxAgentScore = topAgents[0]?.score || 0;

    const byChannel = ["EMAIL", "CHAT", "PHONE", "MANUAL"].map((channel) => ({
        channel,
        label: channelLabel(channel),
        created: createdByChannel[channel] || 0,
        resolved: resolvedByChannel[channel] || 0
    }));

    const openPeriods = [
        metricOption("live", "Live", openLive),
        metricOption("today", "Today", openToday),
        metricOption("7d", "Last 7 days", open7d),
        metricOption("30d", "Last 30 days", open30d)
    ];
    const pendingPeriods = [
        metricOption("live", "Live", pendingLive),
        metricOption("today", "Today", pendingToday),
        metricOption("7d", "Last 7 days", pending7d),
        metricOption("30d", "Last 30 days", pending30d)
    ];
    const resolvedPeriods = [
        metricOption("today", "Today", resolvedToday),
        metricOption("7d", "Last 7 days", resolved7d),
        metricOption("30d", "Last 30 days", resolved30d),
        metricOption("all", "All time", resolvedAll)
    ];
    const customerPeriods = [
        metricOption("all", "All time", customersAll),
        metricOption("30d", "Last 30 days", customers30d),
        metricOption("7d", "Last 7 days", customers7d),
        metricOption("today", "Today", customersToday)
    ];
    const agentPeriods = [
        metricOption("live", "Live", agentsLive),
        metricOption("today", "Today", agentsToday),
        metricOption("7d", "Last 7 days", agents7d)
    ];

    return {
        generatedAt: new Date().toISOString(),
        period: {
            key: "today",
            label: "Today",
            startsAt: todayStart.toISOString()
        },
        summary: {
            openTickets: {
                value: openLive,
                label: "Open Tickets",
                periodKey: "live",
                periodLabel: "Live",
                periods: openPeriods
            },
            pending: {
                value: pendingLive,
                label: "Pending",
                periodKey: "live",
                periodLabel: "Live",
                periods: pendingPeriods
            },
            resolvedToday: {
                value: resolvedToday,
                label: "Resolved",
                periodKey: "today",
                periodLabel: "Today",
                periods: resolvedPeriods
            },
            totalCustomers: {
                value: customersAll,
                label: "Total Customers",
                periodKey: "all",
                periodLabel: "All time",
                periods: customerPeriods
            },
            activeAgents: {
                value: agentsLive,
                label: "Active agents",
                periodKey: "live",
                periodLabel: "Live",
                periods: agentPeriods
            }
        },
        ticketsByChannel: {
            title: "Tickets by Channel",
            yAxisLabel: "Active Cases",
            series: [
                { key: "created", label: "Created", color: "#2E90FA" },
                { key: "resolved", label: "Resolved", color: "#12B76A" }
            ],
            channels: byChannel
        },
        topAgentsToday: {
            title: "Top agents today",
            maxScore: maxAgentScore,
            agents: topAgents.map((agent) => ({
                ...agent,
                progress: maxAgentScore > 0
                    ? Math.round((agent.score / maxAgentScore) * 100)
                    : 0
            }))
        },
        recentTickets: recentTickets.map((ticket) => {
            const channel = channelMap.get(ticket.id) || "MANUAL";
            return {
                id: ticket.id,
                ticketId: ticket.ticketId,
                title: ticket.title,
                status: ticket.status,
                priority: ticket.priority,
                channel,
                channelLabel: channelLabel(channel),
                reporterName:
                    ticket.customerName ||
                    ticket.assignedToName ||
                    ticket.createdByName ||
                    "Unknown",
                createdAt: ticket.createdAt,
                relativeTime: formatRelativeTime(ticket.createdAt)
            };
        })
    };
}

export default getDashboardOverview;
