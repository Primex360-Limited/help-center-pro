import successResponse from "../../../shared/utils/apiResponse.js";
import {
    assignTicket,
    getOnlineAssignableAgents,
    listAssignableAgents,
    pickQueuedTicket,
    transferTicket
} from "./assignment.service.js";
import { buildActorSnapshotFromRequest } from "../ticket.utils.js";
import { requireTenantId } from "../helpers/tenant-scope.js";

export async function assignTicketHandler(req, res) {
    const ticket = await assignTicket(
        req.validatedParams.ticketId,
        req.validatedBody.assignedToUserId,
        buildActorSnapshotFromRequest(req),
        req.validatedBody.transferReason
    );
    return successResponse(res, "Ticket assigned successfully", { ticket });
}

export async function transferTicketHandler(req, res) {
    const { assignedToUserId, transferReason, ...options } = req.validatedBody;
    const ticket = await transferTicket(
        req.validatedParams.ticketId,
        assignedToUserId,
        transferReason,
        buildActorSnapshotFromRequest(req),
        options
    );

    return successResponse(res, "Ticket transferred successfully", { ticket });
}

export async function listAssignableAgentsHandler(req, res) {
    const tenantId = requireTenantId({ req });
    const agents = await listAssignableAgents(tenantId);
    return successResponse(res, "Assignable agents fetched successfully", { agents });
}

export async function pickQueuedTicketHandler(req, res) {
    const ticket = await pickQueuedTicket(
        req.validatedParams.ticketId,
        buildActorSnapshotFromRequest(req)
    );

    return successResponse(res, "Ticket picked from queue successfully", { ticket });
}

export async function listOnlineAssignableAgentsHandler(req, res) {
    const tenantId = requireTenantId({ req });
    const agents = await getOnlineAssignableAgents(tenantId);

    return successResponse(res, "Online assignable agents fetched successfully", { agents });
}
