import { AppError } from "../../shared/errors/AppError.js";
import {
    createTicketWithTimeline,
    countTickets,
    findTicketByPublicId,
    listTickets
} from "./ticket.repository.js";
import {
    DEFAULT_TICKET_RESOLUTION_HOURS,
    SENDER_TYPE,
    TICKET_CHANNEL,
    TICKET_PRIORITY,
    TICKET_STATUS
} from "./ticket.constants.js";
import { buildPaginationMeta, getPagination } from "./ticket.utils.js";
import { isTicketIdUniqueConflict } from "./helpers/ticket-id-generator.js";
import { buildTicketFilters } from "./helpers/build-ticket-filters.js";
import { resolveCustomerIdentity } from "./helpers/resolve-customer-identity.js";
import { getAssignableUserSnapshot } from "./helpers/ticket-assignee.js";
import { requireTenantId } from "./helpers/tenant-scope.js";
import { buildTicketEventPayload } from "./timeline/timeline.service.js";
import { toCreateTicketDto } from "./dto/create-ticket.dto.js";
import { toListTicketsDto } from "./dto/list-ticket.dto.js";
import { toTicketDetailDto } from "./dto/ticket-detail.dto.js";
import {
    dispatchCustomerCreatedWebhook,
    dispatchTicketCreatedWebhook
} from "../webhooks/webhook.dispatcher.js";

function addHours(date, hours) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function shouldQueueInitialTicket(data, hasAssignment) {
    const hasCustomerIdentity = Boolean(
        data.customerEmail ||
        data.customerPhone ||
        data.customerName ||
        data.customerIp
    );
    const senderType = data.chat?.senderType || (
        hasCustomerIdentity ? SENDER_TYPE.CUSTOMER : SENDER_TYPE.AGENT
    );

    return data.channel === TICKET_CHANNEL.CHAT && senderType === SENDER_TYPE.CUSTOMER && !hasAssignment;
}

export async function createTicket(data, actor) {
    const tenantId = requireTenantId({
        tenantId: actor?.tenantId || data?.tenantId || null
    }, "Tickets must belong to a workspace");

    const customer = await resolveCustomerIdentity({
        customerEmail: data.customerEmail || data.email?.fromEmail,
        customerPhone: data.customerPhone,
        customerName: data.customerName,
        customerIp: data.customerIp,
        tenantId
    });
    const assignmentSnapshot = data.assignedToUserId
        ? await getAssignableUserSnapshot(data.assignedToUserId, tenantId)
        : null;
    const initialStatus = shouldQueueInitialTicket(data, Boolean(assignmentSnapshot))
        ? TICKET_STATUS.QUEUED
        : TICKET_STATUS.OPEN;

    const maxAttempts = 8;
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            // ticketId omitted — allocated atomically inside createTicketWithTimeline
            const now = new Date();
            const resolutionDueAt = data.resolutionDueAt
                ? new Date(data.resolutionDueAt)
                : addHours(now, DEFAULT_TICKET_RESOLUTION_HOURS);
            const initialEvent = buildTicketEventPayload(
                {
                    ...data,
                    chat: {
                        ...(data.chat || {}),
                        message: data.chat?.message || data.description.trim()
                    },
                    email: {
                        ...(data.email || {}),
                        subject: data.email?.subject || data.title.trim(),
                        body: data.email?.body || data.description.trim()
                    }
                },
                actor,
                customer
            );
            initialEvent.metadata = {
                ...(initialEvent.metadata || {}),
                ...(data.initialEventMetadata || {}),
                actor:
                    initialEvent.metadata?.actor ||
                    data.initialEventMetadata?.actor
            };

            const ticket = await createTicketWithTimeline({
                ticketData: {
                    tenantId,
                    title: data.title.trim(),
                    description: data.description.trim(),
                    status: initialStatus,
                    priority: data.priority || TICKET_PRIORITY.MEDIUM,
                    customerId: customer.customerId,
                    customerName: customer.customerName,
                    customerEmail: customer.customerEmail,
                    customerPhone: customer.customerPhone,
                    customerIp: customer.customerIp,
                    queuedAt: initialStatus === TICKET_STATUS.QUEUED ? now : null,
                    resolutionDueAt,
                    lastCustomerResponseAt:
                        initialEvent.createdBy === SENDER_TYPE.CUSTOMER
                            ? now
                            : null,
                    lastAgentResponseAt:
                        initialEvent.createdBy === SENDER_TYPE.AGENT
                            ? now
                            : null,
                    assignedToUserId: assignmentSnapshot?.userId,
                    assignedToName: assignmentSnapshot?.name,
                    assignedToEmail: assignmentSnapshot?.email,
                    createdByUserId: actor.userId,
                    createdByName: actor.name,
                    createdByEmail: actor.email,
                    updatedByUserId: actor.userId,
                    updatedByName: actor.name,
                    updatedByEmail: actor.email
                },
                statusHistoryData: {
                    oldStatus: null,
                    newStatus: initialStatus,
                    changedByUserId: actor.userId,
                    changedByName: actor.name,
                    changedByEmail: actor.email
                },
                assignmentHistoryData: assignmentSnapshot
                    ? {
                        previousAssignedToUserId: null,
                        previousAssignedToName: null,
                        previousAssignedToEmail: null,
                        newAssignedToUserId: assignmentSnapshot.userId,
                        newAssignedToName: assignmentSnapshot.name,
                        newAssignedToEmail: assignmentSnapshot.email,
                        assignedByUserId: actor.userId,
                        assignedByName: actor.name,
                        assignedByEmail: actor.email
                    }
                    : null,
                initialEvent
            });

            const dto = toCreateTicketDto(ticket);
            if (customer.isNew && customer.customerId) {
                dispatchCustomerCreatedWebhook({
                    tenantId,
                    customer
                });
            }
            dispatchTicketCreatedWebhook({
                ...ticket,
                ...dto,
                tenantId
            });
            return dto;
        } catch (error) {
            lastError = error;
            if (isTicketIdUniqueConflict(error) && attempt < maxAttempts - 1) {
                continue;
            }
            throw error;
        }
    }

    throw (
        lastError ||
        new AppError("Unable to create ticket with a unique ID", 500)
    );
}

export async function getTickets(query = {}) {
    const tenantId = requireTenantId(query, "Workspace context is required to list tickets");
    const pagination = getPagination(query);
    const where = buildTicketFilters({ ...query, tenantId });

    const [tickets, total] = await Promise.all([
        listTickets({
            where,
            skip: pagination.skip,
            take: pagination.limit,
            // Newest activity first — agents always see the latest conversation on top.
            orderBy: [
                { updatedAt: "desc" },
                { createdAt: "desc" }
            ]
        }),
        countTickets(where)
    ]);

    return {
        tickets: toListTicketsDto(tickets),
        meta: buildPaginationMeta({
            page: pagination.page,
            limit: pagination.limit,
            total
        })
    };
}

export async function getTicketDetail(ticketId, tenantId) {
    const scopedTenantId = requireTenantId(
        { tenantId },
        "Workspace context is required to view a ticket"
    );
    const ticket = await findTicketByPublicId(ticketId, {
        tenantId: scopedTenantId,
        includeMessages: true
    });

    if (!ticket) {
        throw new AppError("Ticket not found", 404);
    }

    return toTicketDetailDto(ticket);
}
