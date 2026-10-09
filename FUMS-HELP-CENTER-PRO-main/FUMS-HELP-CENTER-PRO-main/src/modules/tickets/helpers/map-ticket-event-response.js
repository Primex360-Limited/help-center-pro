function mapCallLog(log) {
    return {
        id: log.id,
        eventType: log.eventType,
        actor: log.actor,
        direction: log.direction,
        timestamp: log.timestamp
    };
}

function getEventContent(event) {
    if (event.chat) {
        return event.chat.message;
    }

    if (event.email) {
        return {
            subject: event.email.subject,
            body: event.email.body,
            fromEmail: event.email.fromEmail,
            toEmail: event.email.toEmail
        };
    }

    if (event.call) {
        return {
            duration: event.call.duration,
            recordingUrl: event.call.recordingUrl,
            logs: (event.call.logs || []).map(mapCallLog)
        };
    }

    return event.metadata?.content || null;
}

export function mapTicketEventResponse(event) {
    return {
        id: event.id,
        type: event.type,
        channel: event.channel,
        createdAt: event.createdAt,
        actor: event.metadata?.actor || event.createdBy,
        content: getEventContent(event)
    };
}

export function mapLegacyTicketMessageToEventResponse(message) {
    return {
        id: message.id,
        type: "CHAT",
        channel: "CHAT",
        createdAt: message.createdAt,
        actor: {
            type: "AGENT",
            userId: message.senderUserId,
            name: message.senderName,
            email: message.senderEmail
        },
        content: message.content
    };
}

export default mapTicketEventResponse;
