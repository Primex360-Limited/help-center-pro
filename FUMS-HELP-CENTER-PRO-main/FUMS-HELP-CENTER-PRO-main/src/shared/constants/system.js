export const USER_STATUS = Object.freeze({
    INVITED: "invited",
    ACTIVE: "active",
    INACTIVE: "inactive",
    SUSPENDED: "suspended"
});

export const INVITATION_STATUS = Object.freeze({
    PENDING: "pending",
    ACCEPTED: "accepted",
    EXPIRED: "expired",
    REVOKED: "revoked"
});

export const DEFAULT_SYSTEM_PERMISSIONS = Object.freeze([
    "manage_users",
    "manage_roles",
    "ticket.view",
    "ticket.update_status",
    "ticket.assign",
    "ticket.transfer",
    "ticket.pick_queue",
    "ticket.supervise",
    "ticket.message",
    "ticket.add_note",
    "ticket.receive_assignment"
]);

export const ADMIN_PERMISSIONS = Object.freeze([
    "manage_users",
    "manage_roles",
    "ticket.view",
    "ticket.update_status",
    "ticket.assign",
    "ticket.transfer",
    "ticket.pick_queue",
    "ticket.supervise",
    "ticket.message",
    "ticket.add_note",
    "ticket.receive_assignment"
]);

export const AGENT_PERMISSIONS = Object.freeze([
    "ticket.view",
    "ticket.update_status",
    "ticket.message",
    "ticket.add_note",
    "ticket.receive_assignment",
    "ticket.pick_queue"
]);

export const SYSTEM_ROLE = Object.freeze({
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    AGENT: "Agent"
});

export const AUDIT_ACTION = Object.freeze({
    USER_REGISTERED: "USER_REGISTERED",
    USER_INVITED: "USER_INVITED",
    INVITATION_ACCEPTED: "INVITATION_ACCEPTED",
    PASSWORD_CHANGED: "PASSWORD_CHANGED",
    LOGIN_SUCCESS: "LOGIN_SUCCESS",
    ROLE_CREATED: "ROLE_CREATED",
    ROLE_UPDATED: "ROLE_UPDATED",
    ROLE_ASSIGNED: "ROLE_ASSIGNED",
    ROLE_REMOVED: "ROLE_REMOVED",
    PERMISSION_CREATED: "PERMISSION_CREATED",
    PERMISSION_ASSIGNED: "PERMISSION_ASSIGNED",
    USER_UPDATED: "USER_UPDATED",
    USER_STATUS_UPDATED: "USER_STATUS_UPDATED",
    USER_PERMISSION_OVERRIDES_UPDATED: "USER_PERMISSION_OVERRIDES_UPDATED"
});
