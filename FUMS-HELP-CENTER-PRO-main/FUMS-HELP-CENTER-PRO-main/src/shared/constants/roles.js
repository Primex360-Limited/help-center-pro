import { PERMISSION } from "./permissions.js";

/**
 * Role model for Help Centre Pro Phase 1.
 *
 * Two scopes:
 *  - `provider` roles belong to the Help Centre Pro platform (tenantId = null)
 *    and operate the super-admin portal at admin.<root-domain>.
 *  - `tenant`   roles are provisioned per tenant and operate inside one workspace.
 */

export const ROLE_SCOPE = Object.freeze({
    PROVIDER: "provider",
    TENANT: "tenant"
});

export const PROVIDER_ROLE = Object.freeze({
    SUPER_ADMIN: "Provider Super Admin"
});

export const TENANT_ROLE = Object.freeze({
    ADMIN: "Tenant Admin",
    SUPERVISOR: "Tenant Supervisor",
    AGENT: "Tenant Agent"
});

/** Full tenant-admin capability set (everything scoped to a single workspace). */
const TENANT_ADMIN_PERMISSIONS = Object.freeze([
    PERMISSION.TICKET_READ,
    PERMISSION.TICKET_CREATE,
    PERMISSION.TICKET_UPDATE,
    PERMISSION.TICKET_ASSIGN,
    PERMISSION.TICKET_TRANSFER,
    PERMISSION.TICKET_CLOSE,
    PERMISSION.TICKET_PICK,
    PERMISSION.TICKET_SUPERVISE,
    PERMISSION.MESSAGE_CREATE,
    PERMISSION.NOTE_CREATE,
    PERMISSION.TEMPLATE_READ,
    PERMISSION.TEMPLATE_CREATE,
    PERMISSION.TEMPLATE_UPDATE,
    PERMISSION.TEMPLATE_DELETE,
    PERMISSION.AGENT_READ,
    PERMISSION.AGENT_INVITE,
    PERMISSION.AGENT_UPDATE,
    PERMISSION.AGENT_DEACTIVATE,
    PERMISSION.ROLE_READ,
    PERMISSION.ROLE_MANAGE,
    PERMISSION.SETTINGS_READ,
    PERMISSION.SETTINGS_WRITE,
    PERMISSION.REPORT_READ
]);

const TENANT_SUPERVISOR_PERMISSIONS = Object.freeze([
    PERMISSION.TICKET_READ,
    PERMISSION.TICKET_CREATE,
    PERMISSION.TICKET_UPDATE,
    PERMISSION.TICKET_ASSIGN,
    PERMISSION.TICKET_TRANSFER,
    PERMISSION.TICKET_CLOSE,
    PERMISSION.TICKET_PICK,
    PERMISSION.TICKET_SUPERVISE,
    PERMISSION.MESSAGE_CREATE,
    PERMISSION.NOTE_CREATE,
    PERMISSION.TEMPLATE_READ,
    PERMISSION.TEMPLATE_CREATE,
    PERMISSION.AGENT_READ,
    PERMISSION.SETTINGS_READ,
    PERMISSION.REPORT_READ
]);

const TENANT_AGENT_PERMISSIONS = Object.freeze([
    PERMISSION.TICKET_READ,
    PERMISSION.TICKET_UPDATE,
    PERMISSION.TICKET_PICK,
    PERMISSION.MESSAGE_CREATE,
    PERMISSION.NOTE_CREATE,
    PERMISSION.TEMPLATE_READ
]);

export const ROLE_DEFINITIONS = Object.freeze([
    {
        name: PROVIDER_ROLE.SUPER_ADMIN,
        scope: ROLE_SCOPE.PROVIDER,
        isSystem: true,
        description: "Help Centre Pro platform operator — provisions and manages tenants",
        permissions: [
            PERMISSION.TENANT_MANAGE,
            PERMISSION.ROLE_MANAGE,
            PERMISSION.ROLE_READ,
            PERMISSION.REPORT_READ
        ]
    },
    {
        name: TENANT_ROLE.ADMIN,
        scope: ROLE_SCOPE.TENANT,
        isSystem: true,
        description: "Tenant administrator — full control of the workspace",
        permissions: TENANT_ADMIN_PERMISSIONS
    },
    {
        name: TENANT_ROLE.SUPERVISOR,
        scope: ROLE_SCOPE.TENANT,
        isSystem: true,
        description: "Tenant supervisor — manages the shared ticket queue and agents",
        permissions: TENANT_SUPERVISOR_PERMISSIONS
    },
    {
        name: TENANT_ROLE.AGENT,
        scope: ROLE_SCOPE.TENANT,
        isSystem: true,
        description: "Tenant agent — handles assigned customer conversations",
        permissions: TENANT_AGENT_PERMISSIONS
    }
]);

/** Roles a tenant admin is allowed to hand out when inviting a teammate. */
export const INVITABLE_TENANT_ROLES = Object.freeze([
    TENANT_ROLE.ADMIN,
    TENANT_ROLE.SUPERVISOR,
    TENANT_ROLE.AGENT
]);

export function getRoleDefinition(name) {
    return ROLE_DEFINITIONS.find((role) => role.name === name) || null;
}

export function isProviderRole(name) {
    const definition = getRoleDefinition(name);
    return definition?.scope === ROLE_SCOPE.PROVIDER;
}

/**
 * Legacy role names that must keep resolving to the provider super admin.
 *
 * `SYSTEM_ROLE.SUPER_ADMIN` ("Super Admin") predates Phase 1; the Mongo era
 * wrote it into `Role.name` and `rbac.middleware.test.js` pins it, so the
 * provider role is detected by name *or* by `userType`.
 */
export const LEGACY_PROVIDER_ROLE_NAMES = Object.freeze(["Super Admin"]);

/** Every role name that identifies a provider super admin. */
export const SUPER_ADMIN_ROLE_NAMES = Object.freeze([
    PROVIDER_ROLE.SUPER_ADMIN,
    ...LEGACY_PROVIDER_ROLE_NAMES
]);

/** Case/whitespace-insensitive super-admin role-name check. */
export function isSuperAdminRoleName(name) {
    if (!name) {
        return false;
    }

    const candidate = String(name).trim().toLowerCase();

    return SUPER_ADMIN_ROLE_NAMES.some(
        (roleName) => roleName.toLowerCase() === candidate
    );
}
