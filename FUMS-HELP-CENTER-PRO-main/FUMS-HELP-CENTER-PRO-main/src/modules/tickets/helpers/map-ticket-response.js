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

function resolveTicketChannel(ticket) {
    if (ticket.channel) return ticket.channel;
    if (ticket.sourceChannel) return ticket.sourceChannel;

    const events = Array.isArray(ticket.events) ? ticket.events : [];
    const ranked = ["CHAT", "EMAIL", "PHONE"];
    for (const preferred of ranked) {
        if (events.some((event) => event?.channel === preferred)) {
            return preferred;
        }
    }
    return events[0]?.channel || null;
}

export function mapTicketResponse(ticket) {
    const channel = resolveTicketChannel(ticket);

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
    const senderId = String(message.senderUserId || "");
    // Real workspace agents have UUID sender ids. Legacy widget posts that
    // used the secret key landed as system:widget-secret-agent — those are
    // visitor messages and must render on the customer (left) side.
    const isSystemSender = senderId.startsWith("system:");
    const isAgent = Boolean(senderId) && !isSystemSender;
    return {
        id: message.id,
        ticketId: message.ticket?.ticketId || message.ticketId,
        senderType: isAgent ? "AGENT" : "CUSTOMER",
        role: isAgent ? "agent" : "customer",
        sender: {
            userId: isAgent ? message.senderUserId : null,
            type: isAgent ? "AGENT" : "CUSTOMER",
            name: isAgent
                ? message.senderName
                : message.senderName || "Customer",
            email: message.senderEmail
        },
        type: message.messageType,
        content: message.content,
        createdAt: message.createdAt
    };
}

export default mapTicketResponse;
