import prisma from "../../database/prisma/client.js";
import { PERMISSION_CATALOG } from "../../shared/constants/permissions.js";
import { ROLE_DEFINITIONS, ROLE_SCOPE } from "../../shared/constants/roles.js";

/**
 * Postgres-backed seeding for the Phase-1 identity layer.
 *
 * Unlike the legacy Mongo seeder (`seedDefaultRoles.js`) this one is
 * idempotent and *reconciling*: permissions are upserted from the canonical
 * catalog and each system role's `RolePermission` rows are synced to exactly
 * match its definition, so removing a permission from `roles.js` also removes
 * it from the database on the next run.
 */

/** Upsert every entry of the canonical permission catalog. */
export async function seedPermissionCatalog(client = prisma) {
    const permissions = [];

    for (const entry of PERMISSION_CATALOG) {
        const permission = await client.permission.upsert({
            where: { key: entry.key },
            update: { category: entry.category, description: entry.description },
            create: {
                key: entry.key,
                category: entry.category,
                description: entry.description
            }
        });

        permissions.push(permission);
    }

    return permissions;
}

/**
 * Reconcile a role's permissions to exactly `permissionIds`.
 * Uses deleteMany + createMany so revoked permissions are actually revoked.
 */
async function syncRolePermissions(client, roleId, permissionIds) {
    // `permissionId` is a `uuid` column: an empty target set must use a plain
    // `{ roleId }` delete, never a `notIn` sentinel (Postgres would reject the
    // non-UUID literal).
    await client.rolePermission.deleteMany({
        where: permissionIds.length
            ? { roleId, permissionId: { notIn: permissionIds } }
            : { roleId }
    });

    if (!permissionIds.length) {
        return;
    }

    await client.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true
    });
}

/**
 * Create/refresh a single system role inside a scope.
 *
 * @param {object}  params
 * @param {string}  params.name          Role name (from `roles.js`).
 * @param {string|null} params.tenantId  `null` for provider roles, tenant UUID otherwise.
 * @param {boolean} params.isSystem
 * @param {string}  params.description
 * @param {string[]} params.permissions  Permission keys.
 * @param {Map<string, object>} permissionByKey
 */
async function upsertSystemRole(client, definition, tenantId, permissionByKey) {
    const { name, description, isSystem } = definition;

    const existing = await client.role.findFirst({
        where: { name, tenantId },
        select: { id: true }
    });

    const role = existing
        ? await client.role.update({
              where: { id: existing.id },
              data: { description, isSystem }
          })
        : await client.role.create({
              data: { name, description, isSystem, tenantId }
          });

    const permissionIds = definition.permissions
        .map((key) => permissionByKey.get(key))
        .filter(Boolean)
        .map((permission) => permission.id);

    await syncRolePermissions(client, role.id, permissionIds);

    return { role, created: !existing, permissionCount: permissionIds.length };
}

/**
 * Seed the platform-wide identity data:
 *  1. the full permission catalog
 *  2. provider-scope roles (tenants have not been provisioned yet)
 *
 * Safe to run on every boot — it is fully idempotent.
 */
export async function seedSystemRoles(client = prisma) {
    const permissions = await seedPermissionCatalog(client);
    const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));

    const results = [];

    for (const definition of ROLE_DEFINITIONS) {
        if (definition.scope !== ROLE_SCOPE.PROVIDER) {
            continue;
        }

        results.push(await upsertSystemRole(client, definition, null, permissionByKey));
    }

    return results;
}

/**
 * Provision the standard tenant roles for a freshly created tenant.
 * Called from the tenant-provisioning service (Runs inside the caller's
 * transaction when one is supplied).
 *
 * @returns {Promise<{ admin: object, supervisor: object, agent: object }>}
 */
export async function provisionTenantRoles(tenantId, client = prisma) {
    const permissions = await seedPermissionCatalog(client);
    const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));

    const roles = {};

    for (const definition of ROLE_DEFINITIONS) {
        if (definition.scope !== ROLE_SCOPE.TENANT) {
            continue;
        }

        const { role } = await upsertSystemRole(client, definition, tenantId, permissionByKey);
        roles[definition.name] = role;
    }

    return roles;
}

export default seedSystemRoles;
