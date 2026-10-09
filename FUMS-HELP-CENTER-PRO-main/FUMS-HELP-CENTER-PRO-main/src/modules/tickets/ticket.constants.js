export const TICKET_STATUS = Object.freeze({
    QUEUED: "QUEUED",
    OPEN: "OPEN",
    PENDING: "PENDING",
    WAITING_FOR_REPLY: "WAITING_FOR_REPLY",
    RESOLVED: "RESOLVED",
    CLOSED: "CLOSED",
});

export const TICKET_PRIORITY = Object.freeze({
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
});

export const MESSAGE_TYPE = Object.freeze({
    MESSAGE: "message",
    INTERNAL_NOTE: "internal_note",
});

export const TICKET_EVENT_TYPE = Object.freeze({
    EMAIL: "EMAIL",
    CHAT: "CHAT",
    CALL: "CALL",
    LOG: "LOG",
});

export const TICKET_CHANNEL = Object.freeze({
    EMAIL: "EMAIL",
    CHAT: "CHAT",
    PHONE: "PHONE",
});

export const SENDER_TYPE = Object.freeze({
    AGENT: "AGENT",
    CUSTOMER: "CUSTOMER",
});

export const CALL_EVENT_TYPE = Object.freeze({
    CALL_INITIATED: "CALL_INITIATED",
    CALL_RECEIVED: "CALL_RECEIVED",
    CALL_PICKED: "CALL_PICKED",
    CALL_HANGUP: "CALL_HANGUP",
});

export const CALL_ACTOR = Object.freeze({
    AGENT: "AGENT",
    CUSTOMER: "CUSTOMER",
    SYSTEM: "SYSTEM",
});

export const CALL_DIRECTION = Object.freeze({
    INBOUND: "INBOUND",
    OUTBOUND: "OUTBOUND",
});

export const TICKET_PERMISSION = Object.freeze({
    VIEW: "ticket.view",
    UPDATE_STATUS: "ticket.update_status",
    ASSIGN: "ticket.assign",
    TRANSFER: "ticket.transfer",
    PICK_QUEUE: "ticket.pick_queue",
    SUPERVISE: "ticket.supervise",
    MESSAGE: "ticket.message",
    ADD_NOTE: "ticket.add_note",
    RECEIVE_ASSIGNMENT: "ticket.receive_assignment",
});

export const TICKET_PERMISSIONS = TICKET_PERMISSION;

export const DEFAULT_TICKET_PAGE = 1;
export const DEFAULT_TICKET_LIMIT = 20;
export const MAX_TICKET_LIMIT = 100;
export const TICKET_ID_PREFIX = "TCKT";
export const DEFAULT_TICKET_RESOLUTION_HOURS = 24;
export const ONLINE_AGENT_WINDOW_MINUTES = 15;
