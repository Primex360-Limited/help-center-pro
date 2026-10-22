import successResponse from "../../../shared/utils/apiResponse.js";
import { buildActorSnapshotFromRequest } from "../ticket.utils.js";
import { replyToTicketByEmail } from "./support-email.service.js";

export async function replyToTicketByEmailHandler(req, res) {
    const result = await replyToTicketByEmail(
        req.validatedParams.ticketId,
        req.validatedBody,
        buildActorSnapshotFromRequest(req)
    );

    return successResponse(res, "Email reply sent successfully", result, 201);
}
