import prisma from "../../../database/prisma/client.js";
import { TICKET_CHANNEL, TICKET_STATUS } from "../ticket.constants.js";

const CHANNEL_LABELS = Object.freeze({
    EMAIL: "Emails",
    CHAT: "Chat",
    PHONE: "Call",
    MANUAL: "Manual"
});

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

export async function getDashboardOverview() {
    const todayStart = startOfUtcDay();

    const [
        openCount,
        pendingCount,
        resolvedTodayRows,
        emailCustomerGroups,
        idOnlyCustomerGroups,
        ticketsCreatedToday,
        recentTickets
    ] = await Promise.all([
        prisma.ticket.count({
            where: { status: { in: [TICKET_STATUS.OPEN, TICKET_STATUS.QUEUED] } }
        }),
        prisma.ticket.count({
            where: {
                status: {
                    in: [TICKET_STATUS.PENDING, TICKET_STATUS.WAITING_FOR_REPLY]
                }
            }
        }),
        prisma.ticketStatusHistory.findMany({
            where: {
                newStatus: TICKET_STATUS.RESOLVED,
                createdAt: { gte: todayStart }
            },
            select: {
                ticketRefId: true,
                changedByUserId: true,
                changedByName: true
            }
        }),
        prisma.ticket.groupBy({
            by: ["customerEmail"],
            where: { customerEmail: { not: null } },
            _count: { _all: true }
        }),
        prisma.ticket.groupBy({
            by: ["customerId"],
            where: {
                customerId: { not: null },
                customerEmail: null
            },
            _count: { _all: true }
        }),
        prisma.ticket.findMany({
            where: { createdAt: { gte: todayStart } },
            select: { id: true }
        }),
        prisma.ticket.findMany({
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
        })
    ]);

    const resolvedTicketIds = [...new Set(resolvedTodayRows.map((row) => row.ticketRefId))];
    const resolvedTodayDetails = resolvedTicketIds.length
        ? await prisma.ticket.findMany({
            where: { id: { in: resolvedTicketIds } },
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

    const uniqueCustomers = new Set();
    for (const group of emailCustomerGroups) {
        if (group.customerEmail) {
            uniqueCustomers.add(group.customerEmail.toLowerCase());
        }
    }
    for (const group of idOnlyCustomerGroups) {
        if (group.customerId) {
            uniqueCustomers.add(`id:${group.customerId}`);
        }
    }

    const byChannel = ["EMAIL", "CHAT", "PHONE", "MANUAL"].map((channel) => ({
        channel,
        label: channelLabel(channel),
        created: createdByChannel[channel] || 0,
        resolved: resolvedByChannel[channel] || 0
    }));

    return {
        generatedAt: new Date().toISOString(),
        period: {
            key: "today",
            label: "Today",
            startsAt: todayStart.toISOString()
        },
        summary: {
            openTickets: {
                value: openCount,
                label: "Open Tickets",
                periodLabel: "Live"
            },
            pending: {
                value: pendingCount,
                label: "Pending",
                periodLabel: "Live"
            },
            resolvedToday: {
                value: resolvedTodayRows.length,
                label: "Resolved Today",
                periodLabel: "Today"
            },
            totalCustomers: {
                value: uniqueCustomers.size,
                label: "Total Customers",
                periodLabel: "All time"
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
