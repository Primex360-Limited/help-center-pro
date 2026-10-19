export function buildTicketFilters({
    status,
    priority,
    assignedToUserId,
    channel,
    q,
    from,
    to
}) {
    const where = {};

    if (status) {
        where.status = status;
    }

    if (priority) {
        where.priority = priority;
    }

    if (assignedToUserId) {
        where.assignedToUserId = assignedToUserId;
    }

    if (channel && channel !== "MANUAL") {
        where.events = {
            some: {
                channel
            }
        };
    } else if (channel === "MANUAL") {
        where.NOT = {
            events: {
                some: {
                    channel: { in: ["EMAIL", "CHAT", "PHONE"] }
                }
            }
        };
    }

    if (q) {
        const term = String(q).trim();
        if (term) {
            where.OR = [
                { ticketId: { contains: term, mode: "insensitive" } },
                { title: { contains: term, mode: "insensitive" } },
                { description: { contains: term, mode: "insensitive" } },
                { customerName: { contains: term, mode: "insensitive" } },
                { customerEmail: { contains: term, mode: "insensitive" } }
            ];
        }
    }

    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) {
            const end = new Date(to);
            if (!Number.isNaN(end.getTime())) {
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }
    }

    return where;
}

export default buildTicketFilters;
