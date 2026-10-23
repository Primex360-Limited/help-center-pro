import { Server } from "socket.io";
import prisma from "../../../database/prisma/client.js";
import allowedCors from "../../../config/corsConfig.js";
import { USER_STATUS } from "../../../shared/constants/system.js";
import { isUuid } from "../../../shared/utils/uuid.js";
import { verifyAccessToken } from "../../auth/auth.utils.js";
import {
    findUserWithRole,
    getEffectivePermissionsFromUser,
    isSuperAdminUser
} from "../../roles/role.service.js";
import { canReceiveTicketAssignment } from "../helpers/ticket-assignee.js";
import { mapTicketResponse } from "../helpers/map-ticket-response.js";
import { createTicket } from "../ticket.service.js";
import { findTicketByPublicId } from "../ticket.repository.js";
import { buildUserSnapshot } from "../ticket.utils.js";
import {
    SENDER_TYPE,
    TICKET_CHANNEL,
    TICKET_PERMISSIONS,
    TICKET_PRIORITY
} from "../ticket.constants.js";
import { addEventToTicket } from "../timeline/timeline.service.js";
import { pickQueuedTicket } from "../assignments/assignment.service.js";

const AGENTS_ROOM = "agents:online";
const QUEUE_ROOM = "tickets:queue";
const ticketRoom = (ticketId) => `ticket:${ticketId}`;
const activeUserSockets = new Map();

let ioInstance = null;

const CHAT_WIDGET_ACTOR = Object.freeze({
    userId: "system:chat-widget",
    name: "Live Chat Widget",
    email: "chat-widget@system.local"
});

function parseCookieHeader(cookieHeader = "") {
    return Object.fromEntries(
        cookieHeader
            .split(";")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => {
                const [key, ...valueParts] = entry.split("=");
                return [key, decodeURIComponent(valueParts.join("="))];
            })
    );
}

function getSocketToken(socket) {
    const authToken = socket.handshake.auth?.token;
    const authorization = socket.handshake.headers?.authorization;
    const cookies = parseCookieHeader(socket.handshake.headers?.cookie);

    if (authToken) {
        return authToken;
    }

    if (authorization?.startsWith("Bearer ")) {
        return authorization.split(" ")[1];
    }

    return cookies.accessToken || null;
}

function getSocketIp(socket) {
    const forwardedFor = socket.handshake.headers?.["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor?.split(",")[0];

    return (
        forwardedIp ||
        socket.handshake.headers?.["x-real-ip"] ||
        socket.handshake.address ||
        null
    )?.replace(/^::ffff:/, "").trim() || null;
}

function hasPermission(socket, permission) {
    if (socket.data.user && isSuperAdminUser(socket.data.user)) {
        return true;
    }

    return Boolean(socket.data.permissions?.includes(permission));
}

function requireAgent(socket) {
    if (!socket.data.user) {
        throw new Error("Authenticated agent connection is required");
    }
}

function requireSocketPermission(socket, permission) {
    requireAgent(socket);

    if (!hasPermission(socket, permission)) {
        throw new Error("Forbidden: insufficient permissions");
    }
}

function ensureMessage(payload = {}) {
    const message = payload.message?.trim();

    if (!message) {
        throw new Error("Message is required");
    }

    return message;
}

function emitAck(ack, payload) {
    if (typeof ack === "function") {
        ack({
            success: true,
            ...payload
        });
    }
}

function emitError(socket, ack, error) {
    const payload = {
        success: false,
        message: error.message || "Socket operation failed"
    };

    if (typeof ack === "function") {
        ack(payload);
        return;
    }

    socket.emit("socket:error", payload);
}

function onSafe(socket, eventName, handler) {
    socket.on(eventName, async (payload = {}, ack) => {
        try {
            await handler(payload, ack);
        } catch (error) {
            emitError(socket, ack, error);
        }
    });
}

function buildCustomerPayload(socket, payload = {}) {
    return {
        customerName: payload.customerName?.trim(),
        customerEmail: payload.customerEmail?.trim().toLowerCase(),
        customerPhone: payload.customerPhone?.trim(),
        customerIp: payload.customerIp?.trim() || getSocketIp(socket)
    };
}

/**
 * Persist agent presence. Best-effort: a deleted row (or invalid id) must not
 * tear down the socket, mirroring the previous `findByIdAndUpdate` behaviour.
 */
async function setUserPresence(userId, isOnline) {
    if (!isUuid(userId)) {
        return;
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                isOnline,
                lastSeenAt: new Date()
            }
        });
    } catch (error) {
        console.warn("[tickets] presence update skipped:", error.message);
    }
}

async function authenticateSocket(socket, next) {
    try {
        const token = getSocketToken(socket);

        if (!token) {
            socket.data.connectionType = "customer";
            socket.data.customer = {
                customerIp: getSocketIp(socket)
            };
            return next();
        }

        const decoded = verifyAccessToken(token);

        // Access tokens carry the PRD claim set; `sub` is a Postgres uuid.
        const user = isUuid(decoded.sub)
            ? await findUserWithRole(decoded.sub)
            : null;

        if (!user) {
            return next(new Error("Authenticated user no longer exists"));
        }

        if (user.status !== USER_STATUS.ACTIVE) {
            return next(new Error("User account is not active"));
        }

        socket.data.connectionType = "agent";
        socket.data.user = user;
        socket.data.tenantId =
            decoded.tenant_id ?? user.tenantId ?? null;
        socket.data.actor = {
            ...buildUserSnapshot(user),
            tenantId: socket.data.tenantId
        };
        socket.data.permissions = getEffectivePermissionsFromUser(user);

        return next();
    } catch {
        return next(new Error("Invalid or expired access token"));
    }
}

async function markUserOnline(socket) {
    if (!socket.data.user?.id) {
        return;
    }

    const userId = socket.data.user.id.toString();
    const existingSockets = activeUserSockets.get(userId) || new Set();
    existingSockets.add(socket.id);
    activeUserSockets.set(userId, existingSockets);

    await setUserPresence(userId, true);
}

async function markUserOfflineIfNeeded(socket) {
    if (!socket.data.user?.id) {
        return;
    }

    const userId = socket.data.user.id.toString();
    const existingSockets = activeUserSockets.get(userId);

    if (!existingSockets) {
        return;
    }

    existingSockets.delete(socket.id);

    if (existingSockets.size) {
        activeUserSockets.set(userId, existingSockets);
        return;
    }

    activeUserSockets.delete(userId);

    await setUserPresence(userId, false);
}

async function joinDefaultAgentRooms(socket) {
    if (!socket.data.user) {
        return;
    }

    socket.join(AGENTS_ROOM);

    if (canReceiveTicketAssignment(socket.data.user)) {
        socket.join(QUEUE_ROOM);
    }
}

async function assertCustomerCanUseTicket(ticket, customer = {}) {
    if (!ticket) {
        throw new Error("Ticket not found");
    }

    if (
        ticket.customerEmail &&
        customer.customerEmail &&
        ticket.customerEmail.toLowerCase() !== customer.customerEmail.toLowerCase()
    ) {
        throw new Error("Customer email does not match this ticket");
    }
}

async function resolveCustomerTenantId(socket, payload = {}) {
    if (payload.tenantId) return payload.tenantId;
    if (socket.data.tenantId) return socket.data.tenantId;

    const slug =
        payload.tenantSlug ||
        payload.workspace ||
        socket.handshake?.query?.tenant ||
        socket.handshake?.query?.tenantSlug ||
        null;

    if (!slug) return null;

    const tenant = await prisma.tenant.findFirst({
        where: {
            OR: [{ slug: String(slug) }, { primaryDomain: String(slug) }]
        },
        select: { id: true }
    });

    return tenant?.id || null;
}

async function handleCustomerStartChat(io, socket, payload, ack) {
    const message = ensureMessage(payload);
    const customer = buildCustomerPayload(socket, payload);
    const tenantId = await resolveCustomerTenantId(socket, payload);
    if (!tenantId) {
        throw new Error("Workspace context is required to start a chat");
    }
    socket.data.tenantId = tenantId;
    const title = payload.title?.trim() ||
        `Live chat from ${customer.customerName || customer.customerEmail || customer.customerIp || "customer"}`;
    const ticket = await createTicket(
        {
            title,
            description: message,
            priority: payload.priority || TICKET_PRIORITY.MEDIUM,
            tenantId,
            ...customer,
            channel: TICKET_CHANNEL.CHAT,
            chat: {
                message,
                senderType: SENDER_TYPE.CUSTOMER
            }
        },
        { ...CHAT_WIDGET_ACTOR, tenantId }
    );

    socket.data.customer = {
        ...socket.data.customer,
        ...customer,
        ticketId: ticket.ticketId
    };
    socket.join(ticketRoom(ticket.ticketId));

    io.to(QUEUE_ROOM).emit("ticket:queued", { ticket });
    io.to(ticketRoom(ticket.ticketId)).emit("ticket:created", { ticket });

    emitAck(ack, { ticket });
}

async function handleCustomerJoinTicket(socket, payload, ack) {
    const tenantId = await resolveCustomerTenantId(socket, payload);
    const ticket = await findTicketByPublicId(payload.ticketId, {
        ...(tenantId ? { tenantId } : {})
    });
    const customer = buildCustomerPayload(socket, payload);

    await assertCustomerCanUseTicket(ticket, customer);

    socket.data.customer = {
        ...socket.data.customer,
        ...customer,
        ticketId: ticket.ticketId
    };
    socket.join(ticketRoom(ticket.ticketId));

    emitAck(ack, { ticket: mapTicketResponse(ticket) });
}

async function handleCustomerSendMessage(io, socket, payload, ack) {
    const message = ensureMessage(payload);
    const tenantId =
        (await resolveCustomerTenantId(socket, payload)) ||
        socket.data.tenantId ||
        null;
    const ticket = await findTicketByPublicId(
        payload.ticketId || socket.data.customer?.ticketId,
        { ...(tenantId ? { tenantId } : {}) }
    );
    const customer = buildCustomerPayload(socket, payload);

    await assertCustomerCanUseTicket(ticket, customer);

    const event = await addEventToTicket(
        ticket.ticketId,
        {
            ...customer,
            tenantId: ticket.tenantId,
            channel: TICKET_CHANNEL.CHAT,
            chat: {
                message,
                senderType: SENDER_TYPE.CUSTOMER
            }
        },
        { ...CHAT_WIDGET_ACTOR, tenantId: ticket.tenantId }
    );

    socket.join(ticketRoom(ticket.ticketId));
    io.to(ticketRoom(ticket.ticketId)).emit("ticket:event", {
        ticketId: ticket.ticketId,
        event
    });
    io.to(QUEUE_ROOM).emit("ticket:customer_message", {
        ticketId: ticket.ticketId,
        event
    });

    emitAck(ack, { event });
}

async function handleAgentJoinQueue(socket, _payload, ack) {
    requireAgent(socket);
    socket.join(QUEUE_ROOM);
    emitAck(ack, { room: QUEUE_ROOM });
}

async function handleAgentJoinTicket(socket, payload, ack) {
    requireSocketPermission(socket, TICKET_PERMISSIONS.VIEW);

    const tenantId = socket.data.tenantId;
    if (!tenantId) {
        throw new Error("Workspace context is required");
    }

    const ticket = await findTicketByPublicId(payload.ticketId, { tenantId });

    if (!ticket) {
        throw new Error("Ticket not found");
    }

    socket.join(ticketRoom(ticket.ticketId));
    emitAck(ack, { ticket: mapTicketResponse(ticket) });
}

async function handleSupervisorJoinTicket(socket, payload, ack) {
    requireSocketPermission(socket, TICKET_PERMISSIONS.SUPERVISE);

    const tenantId = socket.data.tenantId;
    if (!tenantId) {
        throw new Error("Workspace context is required");
    }

    const ticket = await findTicketByPublicId(payload.ticketId, { tenantId });

    if (!ticket) {
        throw new Error("Ticket not found");
    }

    socket.join(ticketRoom(ticket.ticketId));
    emitAck(ack, {
        ticket: mapTicketResponse(ticket),
        supervised: true
    });
}

async function handleAgentSendMessage(io, socket, payload, ack) {
    requireSocketPermission(socket, TICKET_PERMISSIONS.MESSAGE);

    const message = ensureMessage(payload);
    const event = await addEventToTicket(
        payload.ticketId,
        {
            channel: TICKET_CHANNEL.CHAT,
            chat: {
                message,
                senderType: SENDER_TYPE.AGENT
            }
        },
        socket.data.actor
    );

    io.to(ticketRoom(payload.ticketId)).emit("ticket:event", {
        ticketId: payload.ticketId,
        event
    });

    emitAck(ack, { event });
}

async function handleAgentPickFromQueue(io, socket, payload, ack) {
    requireSocketPermission(socket, TICKET_PERMISSIONS.PICK_QUEUE);

    const ticket = await pickQueuedTicket(payload.ticketId, socket.data.actor);

    socket.join(ticketRoom(ticket.ticketId));
    io.to(QUEUE_ROOM).emit("ticket:picked", { ticket });
    io.to(ticketRoom(ticket.ticketId)).emit("ticket:picked", { ticket });

    emitAck(ack, { ticket });
}

function handleTyping(io, socket, payload = {}) {
    const ticketId = payload.ticketId || socket.data.customer?.ticketId;

    if (!ticketId) {
        return;
    }

    socket.to(ticketRoom(ticketId)).emit("ticket:typing", {
        ticketId,
        isTyping: Boolean(payload.isTyping),
        actor: socket.data.actor || {
            type: SENDER_TYPE.CUSTOMER,
            ...socket.data.customer
        }
    });
}

export function initializeTicketRealtime(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: allowedCors,
            credentials: true
        }
    });

    io.use(authenticateSocket);

    io.on("connection", async (socket) => {
        await markUserOnline(socket);
        await joinDefaultAgentRooms(socket);

        if (socket.data.actor) {
            io.to(AGENTS_ROOM).emit("agent:online", {
                agent: socket.data.actor
            });
        }

        onSafe(socket, "customer:start_chat", (payload, ack) =>
            handleCustomerStartChat(io, socket, payload, ack));
        onSafe(socket, "customer:join_ticket", (payload, ack) =>
            handleCustomerJoinTicket(socket, payload, ack));
        onSafe(socket, "customer:send_message", (payload, ack) =>
            handleCustomerSendMessage(io, socket, payload, ack));
        onSafe(socket, "agent:join_queue", (payload, ack) =>
            handleAgentJoinQueue(socket, payload, ack));
        onSafe(socket, "agent:join_ticket", (payload, ack) =>
            handleAgentJoinTicket(socket, payload, ack));
        onSafe(socket, "agent:send_message", (payload, ack) =>
            handleAgentSendMessage(io, socket, payload, ack));
        onSafe(socket, "agent:pick_from_queue", (payload, ack) =>
            handleAgentPickFromQueue(io, socket, payload, ack));
        onSafe(socket, "supervisor:join_ticket", (payload, ack) =>
            handleSupervisorJoinTicket(socket, payload, ack));
        socket.on("ticket:typing", (payload) => handleTyping(io, socket, payload));

        socket.on("disconnect", async () => {
            await markUserOfflineIfNeeded(socket);

            if (socket.data.actor && !activeUserSockets.has(socket.data.actor.userId)) {
                io.to(AGENTS_ROOM).emit("agent:offline", {
                    agent: socket.data.actor
                });
            }
        });
    });

    ioInstance = io;

    return io;
}

export function broadcastTicketCreated(ticket, metadata = {}) {
    if (!ioInstance) {
        return;
    }

    ioInstance.to(AGENTS_ROOM).emit("ticket:created", {
        ticket,
        ...metadata
    });
}

export function broadcastTicketEvent(ticketId, event, metadata = {}) {
    if (!ioInstance) {
        return;
    }

    ioInstance.to(ticketRoom(ticketId)).emit("ticket:event", {
        ticketId,
        event,
        ...metadata
    });
}

export function broadcastInboundEmail({ ticket, event, created = false }) {
    if (!ioInstance) {
        return;
    }

    const payload = {
        ticket,
        event,
        created,
        source: "EMAIL"
    };

    ioInstance.to(AGENTS_ROOM).emit("ticket:email_received", payload);

    if (ticket?.ticketId && event) {
        broadcastTicketEvent(ticket.ticketId, event, {
            source: "EMAIL"
        });
    }
}

export async function closeTicketRealtime() {
    if (!ioInstance) {
        return;
    }

    await new Promise((resolve) => {
        ioInstance.close(resolve);
    });
    ioInstance = null;
}

export default initializeTicketRealtime;
