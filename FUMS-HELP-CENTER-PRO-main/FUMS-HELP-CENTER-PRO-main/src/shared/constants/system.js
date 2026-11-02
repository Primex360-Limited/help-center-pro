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

/**
 * Lifecycle of a tenant workspace. Values mirror the Prisma `TenantStatus`
 * enum so the same string works in SQL filters and app-level comparisons.
 */
export const TENANT_STATUS = Object.freeze({
    PROVISIONING: "provisioning",
    ACTIVE: "active",
    SUSPENDED: "suspended"
});

/**
 * Distinguishes Help Centre Pro platform operators (provider) from users that
 * belong to a tenant workspace. Mirrors the Prisma `UserType` enum.
 */
export const USER_TYPE = Object.freeze({
    PROVIDER: "provider",
    TENANT: "tenant"
});

/**
 * Resolved scope of an incoming request:
 *  - `provider` -> super-admin portal, spans all tenants
 *  - `tenant`   -> a single workspace
 */
export const REQUEST_SCOPE = Object.freeze({
    PROVIDER: "provider",
    TENANT: "tenant"
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
    PASSWORD_RESET: "PASSWORD_RESET",
    LOGIN_SUCCESS: "LOGIN_SUCCESS",
    ROLE_CREATED: "ROLE_CREATED",
    ROLE_UPDATED: "ROLE_UPDATED",
    ROLE_ASSIGNED: "ROLE_ASSIGNED",
    ROLE_REMOVED: "ROLE_REMOVED",
    PERMISSION_CREATED: "PERMISSION_CREATED",
    PERMISSION_ASSIGNED: "PERMISSION_ASSIGNED",
    USER_UPDATED: "USER_UPDATED",
    USER_DELETED: "USER_DELETED",
    USER_STATUS_UPDATED: "USER_STATUS_UPDATED",
    USER_PERMISSION_OVERRIDES_UPDATED: "USER_PERMISSION_OVERRIDES_UPDATED",

    // Phase-1 multi-tenancy
    TENANT_PROVISIONED: "TENANT_PROVISIONED",
    TENANT_UPDATED: "TENANT_UPDATED",
    TENANT_SUSPENDED: "TENANT_SUSPENDED",
    TENANT_REACTIVATED: "TENANT_REACTIVATED",
    TENANT_ADMIN_INVITED: "TENANT_ADMIN_INVITED",
    WORKSPACE_PROFILE_UPDATED: "WORKSPACE_PROFILE_UPDATED",
    TENANT_SESSIONS_REVOKED: "TENANT_SESSIONS_REVOKED",
    ADMIN_SESSIONS_REVOKED: "ADMIN_SESSIONS_REVOKED",

    // Provider admin operations
    PLAN_UPDATED: "PLAN_UPDATED",
    INVOICE_STATUS_UPDATED: "INVOICE_STATUS_UPDATED"
});
