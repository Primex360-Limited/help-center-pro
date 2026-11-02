import prisma from "../../database/prisma/client.js";
import { env } from "../../config/env.js";
import { USER_STATUS, USER_TYPE } from "../../shared/constants/system.js";
import { SUPER_ADMIN_ROLE_NAMES } from "../../shared/constants/roles.js";
import { hashPassword } from "./auth.utils.js";
import { seedSystemRoles } from "../roles/seedSystemRoles.js";

/**
 * Bootstrap-only seeding.
 *
 * The platform never creates demo workspaces, demo tickets or test tenant
 * accounts: every workspace, invoice and audit row an operator sees is real.
 * The only row seeded here is the default platform super admin, so a fresh
 * install can be signed into (see `ensureDefaultSuperAdmin`).
 */

/** Default platform super admin (seeded when SEED_PROVIDER_SUPER_ADMIN=true). */
export const DEFAULT_SUPER_ADMIN = Object.freeze({
    email: "ebube.okechukwu@primex360.com",
    password: "2020/EN/12566",
    firstName: "Ebube",
    lastName: "Okechukwu"
});

const LEGACY_SUPER_ADMIN_EMAILS = Object.freeze([
    "ebube.okechukwu@gmail.com"
]);

/** Emails created by older builds' demo seeding — used by the purge script. */
export const LEGACY_DEMO_EMAILS = Object.freeze([
    "test@test.com",
    "amaka@primex360.com",
    "admin@helpcentrepro.com"
]);

export const LEGACY_DEMO_TENANT_SLUGS = Object.freeze(["primex360", "demo"]);

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

export async function resolveProviderSuperAdminRole(client = prisma) {
    await seedSystemRoles(client);

    const role = await client.role.findFirst({
        where: {
            tenantId: null,
            name: { in: [...SUPER_ADMIN_ROLE_NAMES] }
        },
        orderBy: { createdAt: "asc" }
    });

    if (!role) {
        throw new Error(
            "Provider Super Admin role is missing after seeding system roles"
        );
    }

    return role;
}

async function upsertProviderUser(role, account) {
    const email = normalizeEmail(account.email);
    const passwordHash = await hashPassword(account.password);

    const existing = await prisma.user.findFirst({
        where: { tenantId: null, email },
        select: { id: true, emailVerifiedAt: true }
    });

    const baseData = {
        tenantId: null,
        userType: USER_TYPE.PROVIDER,
        email,
        passwordHash,
        firstName: account.firstName,
        lastName: account.lastName,
        roleId: role.id,
        status: USER_STATUS.ACTIVE,
        emailVerified: true,
        mustChangePassword: false,
        deniedPermissions: []
    };

    if (existing) {
        const user = await prisma.user.update({
            where: { id: existing.id },
            data: {
                ...baseData,
                emailVerifiedAt: existing.emailVerifiedAt ?? new Date()
            }
        });
        console.log(`♻️  Provider super admin updated: ${email}`);
        return user;
    }

    const user = await prisma.user.create({
        data: {
            ...baseData,
            emailVerifiedAt: new Date()
        }
    });
    console.log(`✅ Provider super admin created: ${email}`);
    return user;
}

/**
 * Ensure the default platform super admin exists (local + production).
 * Controlled by SEED_PROVIDER_SUPER_ADMIN.
 *
 * Initial credentials are restored until the first successful login
 * (`lastLoginAt` set). After that, password changes are preserved.
 */
export async function ensureDefaultSuperAdmin() {
    if (!env.SEED_PROVIDER_SUPER_ADMIN) {
        return null;
    }

    const role = await resolveProviderSuperAdminRole();
    const email = normalizeEmail(DEFAULT_SUPER_ADMIN.email);
    const passwordHash = await hashPassword(DEFAULT_SUPER_ADMIN.password);

    const existing = await prisma.user.findFirst({
        where: { tenantId: null, email },
        select: { id: true, emailVerifiedAt: true, lastLoginAt: true }
    });

    if (existing) {
        const restoreInitialPassword = !existing.lastLoginAt;
        const user = await prisma.user.update({
            where: { id: existing.id },
            data: {
                userType: USER_TYPE.PROVIDER,
                firstName: DEFAULT_SUPER_ADMIN.firstName,
                lastName: DEFAULT_SUPER_ADMIN.lastName,
                roleId: role.id,
                status: USER_STATUS.ACTIVE,
                emailVerified: true,
                emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
                mustChangePassword: false,
                ...(restoreInitialPassword ? { passwordHash } : {})
            }
        });
        console.log(
            restoreInitialPassword
                ? `♻️  Default super admin ready with initial password: ${email}`
                : `♻️  Default super admin ready: ${email}`
        );
        return user;
    }

    const legacy = await prisma.user.findFirst({
        where: {
            tenantId: null,
            userType: USER_TYPE.PROVIDER,
            email: { in: [...LEGACY_SUPER_ADMIN_EMAILS] }
        },
        select: { id: true, emailVerifiedAt: true, lastLoginAt: true }
    });

    if (legacy) {
        const restoreInitialPassword = !legacy.lastLoginAt;
        const user = await prisma.user.update({
            where: { id: legacy.id },
            data: {
                email,
                userType: USER_TYPE.PROVIDER,
                firstName: DEFAULT_SUPER_ADMIN.firstName,
                lastName: DEFAULT_SUPER_ADMIN.lastName,
                roleId: role.id,
                status: USER_STATUS.ACTIVE,
                emailVerified: true,
                emailVerifiedAt: legacy.emailVerifiedAt ?? new Date(),
                mustChangePassword: false,
                ...(restoreInitialPassword ? { passwordHash } : {})
            }
        });
        console.log(`♻️  Migrated default super admin email → ${email}`);
        return user;
    }

    return upsertProviderUser(role, DEFAULT_SUPER_ADMIN);
}

/**
 * Demo/test-data seeding was removed on purpose.
 *
 * Earlier builds created a demo workspace ("Primex360") plus test tenant admins
 * here, which made the Admin Portal report workspaces, seats and MRR that never
 * existed. Seeding is now a no-op: workspaces only ever come from the real
 * provisioning flow (Admin -> Tenants -> New tenant) or self-serve signup.
 *
 * Kept as an exported no-op so server.js and the microservice entry points keep
 * working without a wider refactor.
 */
export async function seedTestUser() {
    if (env.SEED_TEST_USER && env.NODE_ENV !== "production") {
        console.log(
            "[seedTestUser] Demo seeding is disabled - workspaces come from real signups only."
        );
    }

    return null;
}

export default seedTestUser;
