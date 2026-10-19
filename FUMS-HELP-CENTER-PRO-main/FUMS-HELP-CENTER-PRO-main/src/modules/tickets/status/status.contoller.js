import successResponse from "../../../shared/utils/apiResponse.js";
import { buildActorSnapshotFromRequest } from "../ticket.utils.js";
import { updateTicketPriority, updateTicketStatus } from "./status.service.js";

export async function updateTicketStatusHandler(req, res) {
    const ticket = await updateTicketStatus(
        req.validatedParams.ticketId,
        req.validatedBody.status,
        buildActorSnapshotFromRequest(req)
    );

    return successResponse(res, "Ticket status updated successfully", { ticket });
}

export async function updateTicketPriorityHandler(req, res) {
    const ticket = await updateTicketPriority(
        req.validatedParams.ticketId,
        req.validatedBody.priority,
        buildActorSnapshotFromRequest(req)
    );

    return successResponse(res, "Ticket priority updated successfully", { ticket });
}