import successResponse from "../../../shared/utils/apiResponse.js";
import { buildActorSnapshotFromRequest } from "../ticket.utils.js";
import { updateTicketStatus } from "./status.service.js";

export async function updateTicketStatusHandler(req, res) {
    const ticket = await updateTicketStatus(
        req.validatedParams.ticketId,
        req.validatedBody.status,
        buildActorSnapshotFromRequest(req)
    );

    return successResponse(res, "Ticket status updated successfully", { ticket });
}