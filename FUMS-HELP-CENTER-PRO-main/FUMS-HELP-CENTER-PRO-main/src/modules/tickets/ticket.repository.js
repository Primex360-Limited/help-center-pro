import prisma from "../../database/prisma/client.js";
import { allocateUniqueTicketIdInTx } from "./helpers/ticket-id-generator.js";

function buildTicketInclude({
    includeMessages = false,
    includeStatusHistory = false,
    includeAssignmentHistory = false,
    includeEvents = false
    } = {}) {
    return {
        ...(includeMessages
            ? {
                messages: {
                    orderBy: {
                        createdAt: "asc"
                    }
                }
            }
            : {}),
        ...(includeStatusHistory
            ? {
                statusHistory: {
                    orderBy: {
                        createdAt: "desc"
                    }
                }
            }
            : {}),
        ...(includeAssignmentHistory
            ? {
                assignmentHistory: {
                    orderBy: {
                        createdAt: "desc"
                    }
                }
            }
            : {}),
        ...(includeEvents
            ? {
                events: {
                    orderBy: {
                        createdAt: "asc"
                    },
                    include: {
                        chat: true,
                        email: true,
                        call: {
                            include: {
                                logs: {
                                    orderBy: {
                                        timestamp: "asc"
                                    }
                                }
                            }
                        }
                    }
                }
            }
            : {})
    };
}

export async function ticketIdExists(ticketId) {
    const existingTicket = await prisma.ticket.findUnique({
        where: { ticketId },
        select: { id: true }
    });

    return Boolean(existingTicket);
}

export async function findExistingTicketCustomer({
    customerPhone,
    customerEmail,
    customerIp,
    tenantId
}) {
    const conditions = [
        customerPhone ? { customerPhone } : null,
        customerEmail ? { customerEmail } : null,
        customerIp ? { customerIp } : null
    ].filter(Boolean);

    if (!conditions.length || !tenantId) {
        return null;
    }

    return prisma.ticket.findFirst({
        where: {
            tenantId,
            OR: conditions
        },
        orderBy: {
            createdAt: "asc"
        },
        select: {
            customerId: true,
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            customerIp: true
        }
    });
}

export async function findLatestActiveTicketByCustomerEmail(customerEmail, tenantId = null) {
    if (!customerEmail || !tenantId) {
        return null;
    }

    return prisma.ticket.findFirst({
        where: {
            tenantId,
            customerEmail,
            status: {
                notIn: ["RESOLVED", "CLOSED"]
            }
        },
        orderBy: {
            updatedAt: "desc"
        }
    });
}

export async function findTicketEventByEmailMetadata({ resendEmailId, messageId }) {
    const conditions = [
        resendEmailId
            ? {
                metadata: {
                    path: ["email", "resendEmailId"],
                    equals: resendEmailId
                }
            }
            : null,
        messageId
            ? {
                metadata: {
                    path: ["email", "messageId"],
                    equals: messageId
                }
            }
            : null
    ].filter(Boolean);

    if (!conditions.length) {
        return null;
    }

    return prisma.ticketEvent.findFirst({
        where: {
            OR: conditions
        },
        include: {
            ticket: true,
            chat: true,
            email: true,
            call: {
                include: {
                    logs: {
                        orderBy: {
                            timestamp: "asc"
                        }
                    }
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    });
}

function buildTicketEventCreate({ ticketRefId, event }) {
    return {
        ticketId: ticketRefId,
        type: event.type,
        channel: event.channel,
        createdBy: event.createdBy,
        metadata: event.metadata
    };
}

async function createTicketEventChannel(tx, eventId, event) {
    if (event.chat) {
        await tx.ticketChatMessage.create({
            data: {
                ticketEventId: eventId,
                ...event.chat
            }
        });
    }

    if (event.email) {
        await tx.ticketEmailMessage.create({
            data: {
                ticketEventId: eventId,
                ...event.email
            }
        });
    }

    if (event.call) {
        const call = await tx.ticketCall.create({
            data: {
                ticketEventId: eventId,
                duration: event.call.duration,
                recordingUrl: event.call.recordingUrl
            }
        });

        if (event.call.initialLog) {
            await tx.ticketCallLog.create({
                data: {
                    callId: call.id,
                    ...event.call.initialLog
                }
            });
        }
    }
}

export async function createTicketWithStatusHistory({ ticketData, statusHistoryData }) {
    return prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.create({
            data: ticketData
        });

        await tx.ticketStatusHistory.create({
            data: {
                ...statusHistoryData,
                ticketRefId: ticket.id
            }
        });

        return tx.ticket.findUnique({
            where: { id: ticket.id }
        });
    });
}

export async function createTicketWithTimeline({
    ticketData,
    statusHistoryData,
    assignmentHistoryData,
    initialEvent
}) {
    return prisma.$transaction(
        async (tx) => {
        // Allocate public ID under the same lock as the insert so concurrent
        // creates can never collide on ticketId.
        const ticketId =
            ticketData.ticketId || (await allocateUniqueTicketIdInTx(tx));

        const ticket = await tx.ticket.create({
            data: {
                ...ticketData,
                ticketId
            }
        });

        await tx.ticketStatusHistory.create({
            data: {
                ...statusHistoryData,
                ticketRefId: ticket.id
            }
        });

        if (assignmentHistoryData) {
            await tx.ticketAssignmentHistory.create({
                data: {
                    ...assignmentHistoryData,
                    ticketRefId: ticket.id
                }
            });
        }

        if (initialEvent) {
            const event = await tx.ticketEvent.create({
                data: buildTicketEventCreate({
                    ticketRefId: ticket.id,
                    event: initialEvent
                })
            });

            await createTicketEventChannel(tx, event.id, initialEvent);
        }

        return tx.ticket.findUnique({
            where: { id: ticket.id }
        });
        },
        {
            maxWait: 10000,
            timeout: 20000
        }
    );
}

export async function listTickets({ where, skip, take, orderBy }) {
    return prisma.ticket.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
            events: {
                orderBy: { createdAt: "asc" },
                take: 1,
                select: { channel: true }
            }
        }
    });
}

export async function countTickets(where) {
    return prisma.ticket.count({ where });
}

export async function findTicketByPublicId(ticketId, options = {}) {
    const { tenantId, ...includeOptions } = options;
    const include = buildTicketInclude(includeOptions);
    const where = { ticketId };

    // Fail closed: tenant-scoped lookups never return another workspace's ticket.
    if (tenantId) {
        where.tenantId = tenantId;
    }

    return prisma.ticket.findFirst({
        where,
        ...(Object.keys(include).length > 0 ? { include } : {})
    });
}

export async function createTicketEvent({
    ticketRefId,
    event,
    ticketWorkflowData = null,
    statusHistoryData = null
}) {
    return prisma.$transaction(async (tx) => {
        const createdEvent = await tx.ticketEvent.create({
            data: buildTicketEventCreate({
                ticketRefId,
                event
            })
        });

        await createTicketEventChannel(tx, createdEvent.id, event);

        if (ticketWorkflowData) {
            await tx.ticket.update({
                where: { id: ticketRefId },
                data: ticketWorkflowData
            });
        }

        if (statusHistoryData) {
            await tx.ticketStatusHistory.create({
                data: {
                    ...statusHistoryData,
                    ticketRefId
                }
            });
        }

        return tx.ticketEvent.findUnique({
            where: { id: createdEvent.id },
            include: {
                chat: true,
                email: true,
                call: {
                    include: {
                        logs: {
                            orderBy: {
                                timestamp: "asc"
                            }
                        }
                    }
                }
            }
        });
    });
}

export async function createTicketMessageWithEvent({
    ticketRefId,
    messageData,
    event
}) {
    return prisma.$transaction(async (tx) => {
        const message = await tx.ticketMessage.create({
            data: {
                ticketRefId,
                ...messageData
            }
        });

        const createdEvent = await tx.ticketEvent.create({
            data: buildTicketEventCreate({
                ticketRefId,
                event: {
                    ...event,
                    metadata: {
                        ...(event.metadata || {}),
                        legacyMessageId: message.id
                    }
                }
            })
        });

        await createTicketEventChannel(tx, createdEvent.id, event);

        return message;
    });
}

export async function updateTicketStatusWithHistory({
    ticketRefId,
    status,
    updatedBy,
    history,
    ticketWorkflowData = {}
}) {
    return prisma.$transaction(async (tx) => {
        await tx.ticket.update({
            where: { id: ticketRefId },
            data: {
                status,
                ...ticketWorkflowData,
                updatedByUserId: updatedBy.userId,
                updatedByName: updatedBy.name,
                updatedByEmail: updatedBy.email
            }
        });

        await tx.ticketStatusHistory.create({
            data: {
                ticketRefId,
                oldStatus: history.oldStatus,
                newStatus: history.newStatus,
                changedByUserId: history.changedByUserId,
                changedByName: history.changedByName,
                changedByEmail: history.changedByEmail
            }
        });

        return tx.ticket.findUnique({
            where: { id: ticketRefId }
        });
    });
}

export async function updateTicketAssignmentWithHistory({
    ticketRefId,
    assignment,
    updatedBy,
    history,
    ticketWorkflowData = {},
    logEvent = null
}) {
    return prisma.$transaction(async (tx) => {
        await tx.ticket.update({
            where: { id: ticketRefId },
            data: {
                assignedToUserId: assignment.userId,
                assignedToName: assignment.name,
                assignedToEmail: assignment.email,
                ...ticketWorkflowData,
                updatedByUserId: updatedBy.userId,
                updatedByName: updatedBy.name,
                updatedByEmail: updatedBy.email
            }
        });

        await tx.ticketAssignmentHistory.create({
            data: {
                ticketRefId,
                previousAssignedToUserId: history.previousAssignedToUserId,
                previousAssignedToName: history.previousAssignedToName,
                previousAssignedToEmail: history.previousAssignedToEmail,
                newAssignedToUserId: history.newAssignedToUserId,
                newAssignedToName: history.newAssignedToName,
                newAssignedToEmail: history.newAssignedToEmail,
                assignedByUserId: history.assignedByUserId,
                assignedByName: history.assignedByName,
                assignedByEmail: history.assignedByEmail,
                transferReason: history.transferReason
            }
        });

        if (logEvent) {
            await tx.ticketEvent.create({
                data: buildTicketEventCreate({
                    ticketRefId,
                    event: logEvent
                })
            });
        }

        return tx.ticket.findUnique({
            where: { id: ticketRefId }
        });
    });
}

export async function pickQueuedTicketWithHistory({
    ticketRefId,
    assignment,
    updatedBy,
    statusHistory,
    assignmentHistory,
    logEvent
}) {
    return prisma.$transaction(async (tx) => {
        const now = new Date();

        await tx.ticket.update({
            where: { id: ticketRefId },
            data: {
                status: statusHistory.newStatus,
                assignedToUserId: assignment.userId,
                assignedToName: assignment.name,
                assignedToEmail: assignment.email,
                pickedAt: now,
                waitingForCustomerAt: null,
                updatedByUserId: updatedBy.userId,
                updatedByName: updatedBy.name,
                updatedByEmail: updatedBy.email
            }
        });

        await tx.ticketStatusHistory.create({
            data: {
                ticketRefId,
                oldStatus: statusHistory.oldStatus,
                newStatus: statusHistory.newStatus,
                changedByUserId: statusHistory.changedByUserId,
                changedByName: statusHistory.changedByName,
                changedByEmail: statusHistory.changedByEmail
            }
        });

        await tx.ticketAssignmentHistory.create({
            data: {
                ticketRefId,
                previousAssignedToUserId: assignmentHistory.previousAssignedToUserId,
                previousAssignedToName: assignmentHistory.previousAssignedToName,
                previousAssignedToEmail: assignmentHistory.previousAssignedToEmail,
                newAssignedToUserId: assignmentHistory.newAssignedToUserId,
                newAssignedToName: assignmentHistory.newAssignedToName,
                newAssignedToEmail: assignmentHistory.newAssignedToEmail,
                assignedByUserId: assignmentHistory.assignedByUserId,
                assignedByName: assignmentHistory.assignedByName,
                assignedByEmail: assignmentHistory.assignedByEmail,
                transferReason: assignmentHistory.transferReason
            }
        });

        if (logEvent) {
            await tx.ticketEvent.create({
                data: buildTicketEventCreate({
                    ticketRefId,
                    event: logEvent
                })
            });
        }

        return tx.ticket.findUnique({
            where: { id: ticketRefId }
        });
    });
}

export async function createTicketMessage({ ticketRefId, messageData }) {
    return prisma.ticketMessage.create({
        data: {
            ticketRefId,
            ...messageData
        }
    });
}

export async function listTicketMessages({
    ticketRefId,
    messageType,
    skip,
    take
}) {
    const where = {
        ticketRefId,
        ...(messageType ? { messageType } : {})
    };

    const [messages, total] = await prisma.$transaction([
        prisma.ticketMessage.findMany({
            where,
            skip,
            take,
            orderBy: {
                createdAt: "asc"
            },
            include: {
                ticket: {
                    select: {
                        ticketId: true
                    }
                }
            }
        }),
        prisma.ticketMessage.count({ where })
    ]);

    return { messages, total };
}

export async function listTicketEvents(ticketRefId) {
    return prisma.ticketEvent.findMany({
        where: { ticketId: ticketRefId },
        orderBy: {
            createdAt: "asc"
        },
        include: {
            chat: true,
            email: true,
            call: {
                include: {
                    logs: {
                        orderBy: {
                            timestamp: "asc"
                        }
                    }
                }
            }
        }
    });
}

export async function appendTicketCallLog({ callId, log }) {
    return prisma.ticketCallLog.create({
        data: {
            callId,
            ...log
        }
    });
}
