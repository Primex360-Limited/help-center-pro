import successResponse from "../../../shared/utils/apiResponse.js";
import { buildActorSnapshotFromRequest } from "../ticket.utils.js";
import { addEventToTicket } from "./timeline.service.js";

export async function addTicketEventHandler(req, res) {
    const event = await addEventToTicket(
        req.validatedParams.ticketId,
        req.validatedBody,
        buildActorSnapshotFromRequest(req)
    );

    return successResponse(res, "Ticket event added successfully", { event }, 201);
}
