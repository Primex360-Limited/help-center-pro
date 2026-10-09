export function buildTicketFilters({ status, priority, assignedToUserId }) {
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

    return where;

}

export default buildTicketFilters;
