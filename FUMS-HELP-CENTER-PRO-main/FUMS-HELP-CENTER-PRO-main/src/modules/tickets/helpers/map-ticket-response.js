function mapUserReference(userId, name, email) {
    if (!userId) {
        return null;
    }

    return {
        userId,
        name,
        email
    };
}

function mapCustomerReference(ticket) {
    if (!ticket.customerId && !ticket.customerEmail && !ticket.customerPhone && !ticket.customerIp) {
        return null;
    }

    return {
        customerId: ticket.customerId,
        name: ticket.customerName,
        email: ticket.customerEmail,
        phone: ticket.customerPhone,
        ip: ticket.customerIp
    };
}

export function mapTicketResponse(ticket) {
    const channel =
        ticket.channel ||
        ticket.sourceChannel ||
        ticket.events?.[0]?.channel ||
        null;

    return {
        id: ticket.id,
        ticketId: ticket.ticketId,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        channel: channel || "MANUAL",
        sourceChannel: channel || "MANUAL",
        assignedTo: mapUserReference(
            ticket.assignedToUserId,
            ticket.assignedToName,
            ticket.assignedToEmail
        ),
        createdBy: mapUserReference(
            ticket.createdByUserId,
            ticket.createdByName,
            ticket.createdByEmail
        ),
        updatedBy: mapUserReference(
            ticket.updatedByUserId,
            ticket.updatedByName,
            ticket.updatedByEmail
        ),
        customer: mapCustomerReference(ticket),
        queuedAt: ticket.queuedAt,
        pickedAt: ticket.pickedAt,
        resolutionDueAt: ticket.resolutionDueAt,
        waitingForCustomerAt: ticket.waitingForCustomerAt,
        lastCustomerResponseAt: ticket.lastCustomerResponseAt,
        lastAgentResponseAt: ticket.lastAgentResponseAt,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt
    };
}

export function mapTicketMessageResponse(message) {
    return {
        id: message.id,
        ticketId: message.ticket?.ticketId || message.ticketId,
        sender: {
            userId: message.senderUserId,
            name: message.senderName,
            email: message.senderEmail
        },
        type: message.messageType,
        content: message.content,
        createdAt: message.createdAt
    };
}

export default mapTicketResponse;
