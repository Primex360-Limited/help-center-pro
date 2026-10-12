/**
 * Canonical permission catalog for Help Centre Pro.
 *
 * Permission keys follow the PRD `resource:action` namespace
 * (e.g. `ticket:read`, `agent:invite`, `settings:write`) instead of the
 * legacy dot/underscore style (`ticket.view`).
 *
 * `PERMISSION_CATALOG` is the seed source for the Postgres `Permission`
 * table; `PERMISSION` is the typed lookup used by route-level RBAC guards.
 */

export const PERMISSION = Object.freeze({
    // Ticketing
    TICKET_READ: "ticket:read",
    TICKET_CREATE: "ticket:create",
    TICKET_UPDATE: "ticket:update",
    TICKET_ASSIGN: "ticket:assign",
    TICKET_TRANSFER: "ticket:transfer",
    TICKET_CLOSE: "ticket:close",
    TICKET_PICK: "ticket:pick",
    TICKET_SUPERVISE: "ticket:supervise",

    // Conversation
    MESSAGE_CREATE: "message:create",
    NOTE_CREATE: "note:create",

    // Templates
    TEMPLATE_READ: "template:read",
    TEMPLATE_CREATE: "template:create",
    TEMPLATE_UPDATE: "template:update",
    TEMPLATE_DELETE: "template:delete",

    // Agents / team
    AGENT_READ: "agent:read",
    AGENT_INVITE: "agent:invite",
    AGENT_UPDATE: "agent:update",
    AGENT_DEACTIVATE: "agent:deactivate",

    // Roles
    ROLE_READ: "role:read",
    ROLE_MANAGE: "role:manage",

    // Workspace settings
    SETTINGS_READ: "settings:read",
    SETTINGS_WRITE: "settings:write",

    // Reporting
    REPORT_READ: "report:read",

    // Provider / platform level
    TENANT_MANAGE: "tenant:manage"
});

export const PERMISSION_CATALOG = Object.freeze([
    { key: PERMISSION.TICKET_READ, category: "ticket", description: "View tickets" },
    { key: PERMISSION.TICKET_CREATE, category: "ticket", description: "Create tickets" },
    { key: PERMISSION.TICKET_UPDATE, category: "ticket", description: "Update ticket fields" },
    { key: PERMISSION.TICKET_ASSIGN, category: "ticket", description: "Assign tickets to agents" },
    { key: PERMISSION.TICKET_TRANSFER, category: "ticket", description: "Transfer tickets between agents" },
    { key: PERMISSION.TICKET_CLOSE, category: "ticket", description: "Resolve or close tickets" },
    { key: PERMISSION.TICKET_PICK, category: "ticket", description: "Pick tickets from the shared queue" },
    { key: PERMISSION.TICKET_SUPERVISE, category: "ticket", description: "Supervise and reassign the team queue" },

    { key: PERMISSION.MESSAGE_CREATE, category: "conversation", description: "Reply to customers" },
    { key: PERMISSION.NOTE_CREATE, category: "conversation", description: "Add internal notes" },

    { key: PERMISSION.TEMPLATE_READ, category: "template", description: "View response templates" },
    { key: PERMISSION.TEMPLATE_CREATE, category: "template", description: "Create response templates" },
    { key: PERMISSION.TEMPLATE_UPDATE, category: "template", description: "Edit response templates" },
    { key: PERMISSION.TEMPLATE_DELETE, category: "template", description: "Delete response templates" },

    { key: PERMISSION.AGENT_READ, category: "agent", description: "View agents in the workspace" },
    { key: PERMISSION.AGENT_INVITE, category: "agent", description: "Invite new agents" },
    { key: PERMISSION.AGENT_UPDATE, category: "agent", description: "Edit agent details and roles" },
    { key: PERMISSION.AGENT_DEACTIVATE, category: "agent", description: "Deactivate or reactivate agents" },

    { key: PERMISSION.ROLE_READ, category: "role", description: "View roles" },
    { key: PERMISSION.ROLE_MANAGE, category: "role", description: "Create and edit roles" },

    { key: PERMISSION.SETTINGS_READ, category: "settings", description: "View workspace settings" },
    { key: PERMISSION.SETTINGS_WRITE, category: "settings", description: "Change workspace settings" },

    { key: PERMISSION.REPORT_READ, category: "report", description: "View reports and analytics" },

    { key: PERMISSION.TENANT_MANAGE, category: "tenant", description: "Provision, suspend and reactivate tenants" }
]);

export const ALL_PERMISSION_KEYS = Object.freeze(
    PERMISSION_CATALOG.map((entry) => entry.key)
);

/**
 * Legacy (pre-Phase-1) permission keys mapped onto the canonical PRD catalog.
 *
 * The Mongo-era role documents and the ticket modules still speak the old
 * dot/underscore namespace (`ticket.view`, `manage_users`). Translating them
 * here means one RBAC check works for both namespaces and legacy
 * `deniedPermissions` overrides keep their meaning after the migration.
 *
 * Keys that cover several capabilities (`manage_users`, `manage_roles`) are
 * mapped to their read-level catalog equivalent: over-denying is safe, and the
 * route guards have all been moved to catalog keys.
 */
export const LEGACY_PERMISSION_ALIASES = Object.freeze({
    "ticket.view": PERMISSION.TICKET_READ,
    "ticket.update_status": PERMISSION.TICKET_UPDATE,
    "ticket.assign": PERMISSION.TICKET_ASSIGN,
    "ticket.transfer": PERMISSION.TICKET_TRANSFER,
    "ticket.pick_queue": PERMISSION.TICKET_PICK,
    "ticket.supervise": PERMISSION.TICKET_SUPERVISE,
    "ticket.message": PERMISSION.MESSAGE_CREATE,
    "ticket.add_note": PERMISSION.NOTE_CREATE,
    "ticket.receive_assignment": PERMISSION.TICKET_PICK,
    manage_users: PERMISSION.AGENT_READ,
    manage_roles: PERMISSION.ROLE_READ
});

/**
 * Backwards-compatible alias used by the legacy RBAC helpers
 * (`DEFAULT_SYSTEM_PERMISSIONS`) so both namespaces resolve to the same set.
 */
export const DEFAULT_SYSTEM_PERMISSIONS = ALL_PERMISSION_KEYS;
