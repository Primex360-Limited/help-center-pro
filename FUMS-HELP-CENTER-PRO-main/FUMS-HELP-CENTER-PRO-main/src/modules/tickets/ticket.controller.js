import successResponse from "../../shared/utils/apiResponse.js";
import { buildActorSnapshotFromRequest, getClientIpFromRequest } from "./ticket.utils.js";
import { createTicket, getTicketDetail, getTickets } from "./ticket.service.js";
import { SENDER_TYPE, TICKET_CHANNEL } from "./ticket.constants.js";
import { getTicketThread } from "./timeline/timeline.service.js";

export async function createTicketHandler(req, res) {
    const body = req.validatedBody;
    const shouldCaptureChatIp = body.channel === TICKET_CHANNEL.CHAT &&
        body.chat?.senderType === SENDER_TYPE.CUSTOMER;
    const requestCustomerIp = shouldCaptureChatIp
        ? body.customerIp || getClientIpFromRequest(req)
        : body.customerIp;
    const ticket = await createTicket(
        {
            ...body,
            ...(requestCustomerIp ? { customerIp: requestCustomerIp } : {})
        },
        buildActorSnapshotFromRequest(req)
    );

    return successResponse(res, "Ticket created successfully", { ticket }, 201);
}

export async function listTicketsHandler(req, res) {
    const result = await getTickets(req.validatedQuery);

    return successResponse(
        res,
        "Tickets fetched successfully",
        { tickets: result.tickets },
        200,
        result.meta
    );
}

export async function getTicketDetailHandler(req, res) {
    const ticket = await getTicketDetail(req.validatedParams.ticketId);

    return successResponse(res, "Ticket fetched successfully", { ticket });
}

export async function getTicketThreadHandler(req, res) {
    const thread = await getTicketThread(req.validatedParams.ticketId);

    return successResponse(res, "Ticket thread fetched successfully", { thread });
}
