import successResponse from "../../../shared/utils/apiResponse.js";
import { getClientIpFromRequest } from "../../tickets/ticket.utils.js";
import {
    createWidgetVisitor,
    getWidgetSession,
    getWidgetTicketSettings,
    listWidgetMessages,
    sendWidgetMessage
} from "./widget.service.js";

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
        {
            ...result,
            workspace: {
                id: req.widgetTenant.id,
                name: req.widgetTenant.name,
                slug: req.widgetTenant.slug
            }
        },
        201
    );
}

export async function sendMessageHandler(req, res) {
    const body = req.validatedBody;
    const result = await sendWidgetMessage({
        tenantId: req.widgetTenant.id,
        mode: req.widgetMode,
        keyKind: req.widgetKeyKind,
        ticketId: body.ticketId,
        message: body.message,
        email: body.email,
        name: body.name,
        phone: body.phone,
        role: body.role
    });

    return successResponse(res, "Message sent", result, 201);
}

export async function listMessagesHandler(req, res) {
    const query = req.validatedQuery || req.query || {};
    const result = await listWidgetMessages({
        tenantId: req.widgetTenant.id,
        mode: req.widgetMode,
        ticketId: query.ticketId,
        after: query.after,
        limit: query.limit
    });

    return successResponse(res, "Messages fetched", {
        ...result,
        workspace: {
            id: req.widgetTenant.id,
            name: req.widgetTenant.name,
            slug: req.widgetTenant.slug
        }
    });
}

export async function sessionHandler(req, res) {
    const result = await getWidgetSession({
        tenant: req.widgetTenant,
        mode: req.widgetMode,
        keyKind: req.widgetKeyKind
    });
    return successResponse(res, "Widget session", result);
}

export async function ticketSettingsHandler(req, res) {
    const result = await getWidgetTicketSettings({
        tenant: req.widgetTenant,
        mode: req.widgetMode,
        keyKind: req.widgetKeyKind
    });
    return successResponse(res, "Ticket policy settings", result);
}
