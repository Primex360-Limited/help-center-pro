import successResponse from "../../../shared/utils/apiResponse.js";
import { MESSAGE_TYPE } from "../ticket.constants.js";
import { buildActorSnapshotFromRequest } from "../ticket.utils.js";
import { getTicketMessages, sendTicketMessage } from "./message.service.js";

export async function sendTicketMessageHandler(req, res) {
    const message = await sendTicketMessage(
        req.validatedParams.ticketId,
        req.validatedBody.content,
        buildActorSnapshotFromRequest(req),
        MESSAGE_TYPE.MESSAGE
    );

    return successResponse(res, "Message sent successfully", { message }, 201);
}

export async function listTicketMessagesHandler(req, res) {
    const result = await getTicketMessages(
        req.validatedParams.ticketId,
        req.validatedQuery,
        MESSAGE_TYPE.MESSAGE
    );

    return successResponse(
        res,
        "Messages fetched successfully",
        { messages: result.messages },
        200,
        result.meta
    );
}

export async function addInternalNoteHandler(req, res) {
    const note = await sendTicketMessage(
        req.validatedParams.ticketId,
        req.validatedBody.content,
        buildActorSnapshotFromRequest(req),
        MESSAGE_TYPE.INTERNAL_NOTE
    );

    return successResponse(res, "Internal note added successfully", { note }, 201);
}

export async function listInternalNotesHandler(req, res) {
    const result = await getTicketMessages(
        req.validatedParams.ticketId,
        req.validatedQuery,
        MESSAGE_TYPE.INTERNAL_NOTE
    );

    return successResponse(
        res,
        "Internal notes fetched successfully",
        { notes: result.messages },
        200,
        result.meta
    );
}