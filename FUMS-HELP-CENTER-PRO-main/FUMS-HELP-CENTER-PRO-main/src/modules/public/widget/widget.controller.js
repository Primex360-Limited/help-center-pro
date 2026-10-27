import successResponse from "../../../shared/utils/apiResponse.js";
import { getClientIpFromRequest } from "../../tickets/ticket.utils.js";
import { createWidgetVisitor, sendWidgetMessage } from "./widget.service.js";

export async function createVisitorHandler(req, res) {
    const body = req.validatedBody;
    const result = await createWidgetVisitor({
        tenantId: req.widgetTenant.id,
        mode: req.widgetMode,
        email: body.email,
        phone: body.phone,
        name: body.name,
        message: body.message,
        customerIp: getClientIpFromRequest(req)
    });

    return successResponse(
        res,
        "Visitor session created",
        result,
        201
    );
}

export async function sendMessageHandler(req, res) {
    const body = req.validatedBody;
    const result = await sendWidgetMessage({
        tenantId: req.widgetTenant.id,
        mode: req.widgetMode,
        ticketId: body.ticketId,
        message: body.message,
        email: body.email,
        name: body.name,
        phone: body.phone
    });

    return successResponse(res, "Message sent", result, 201);
}
