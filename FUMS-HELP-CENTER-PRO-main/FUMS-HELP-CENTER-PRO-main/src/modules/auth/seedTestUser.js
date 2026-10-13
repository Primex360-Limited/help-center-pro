import prisma from "../../database/prisma/client.js";
import { env } from "../../config/env.js";
import { TENANT_STATUS, USER_STATUS, USER_TYPE } from "../../shared/constants/system.js";
import { SUPER_ADMIN_ROLE_NAMES, TENANT_ROLE } from "../../shared/constants/roles.js";
import { hashPassword } from "./auth.utils.js";
import { provisionTenantRoles, seedSystemRoles } from "../roles/seedSystemRoles.js";

const DEMO_TENANT = Object.freeze({
    name: "Primex360",
    slug: "primex360",
    primaryDomain: "primex360.com",
    plan: "scale",
    seatLimit: 20,
    settings: {
        country: "Nigeria",
        trial: false,
        mrr: 199
    }
});

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

const PROVIDER_TEST_USERS = [
    DEFAULT_SUPER_ADMIN,
    {
        email: "test@test.com",
        password: "test",
        firstName: "Test",
        lastName: "User"
    }
];

const TENANT_ADMIN_TEST_USERS = [
    {
        email: "amaka@primex360.com",
        password: "2020/EN/12566",
        firstName: "Amaka",
        lastName: "Okoro"
    },
    {
        email: "jetsamjoseph@gmail.com",
        password: "2020/EN/12566",
        firstName: "Joseph",
        lastName: "Jetsam"
    },
    {
        email: "admin@helpcentrepro.com",
        password: "test",
        firstName: "Olivia",
        lastName: "Rhye"
    }
];

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

async function ensureDemoTenant(client = prisma) {
    const existing = await client.tenant.findFirst({
        where: {
            OR: [{ slug: DEMO_TENANT.slug }, { slug: "demo" }]
        }
    });

    if (existing) {
        return client.tenant.update({
            where: { id: existing.id },
            data: {
                name: DEMO_TENANT.name,
                slug: DEMO_TENANT.slug,
                primaryDomain: DEMO_TENANT.primaryDomain,
                plan: DEMO_TENANT.plan,
                seatLimit: DEMO_TENANT.seatLimit,
                settings: DEMO_TENANT.settings,
                status: TENANT_STATUS.ACTIVE
            }
        });
    }

    return client.tenant.create({
        data: {
            name: DEMO_TENANT.name,
            slug: DEMO_TENANT.slug,
            primaryDomain: DEMO_TENANT.primaryDomain,
            plan: DEMO_TENANT.plan,
            seatLimit: DEMO_TENANT.seatLimit,
            settings: DEMO_TENANT.settings,
            status: TENANT_STATUS.ACTIVE
        }
    });
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

async function upsertTenantAdmin(tenantId, adminRoleId, account) {
    const email = normalizeEmail(account.email);
    const passwordHash = await hashPassword(account.password);

    const existingInTenant = await prisma.user.findFirst({
        where: { tenantId, email },
        select: { id: true, emailVerifiedAt: true }
    });
    const existingProvider = await prisma.user.findFirst({
        where: { tenantId: null, email },
        select: { id: true }
    });

    const baseData = {
        tenantId,
        userType: USER_TYPE.TENANT,
        email,
        passwordHash,
        firstName: account.firstName,
        lastName: account.lastName,
        roleId: adminRoleId,
        status: USER_STATUS.ACTIVE,
        emailVerified: true,
        mustChangePassword: false,
        deniedPermissions: []
    };

    if (existingInTenant) {
        const user = await prisma.user.update({
            where: { id: existingInTenant.id },
            data: {
                ...baseData,
                emailVerifiedAt: existingInTenant.emailVerifiedAt ?? new Date()
            }
        });
        console.log(`♻️  Dev tenant admin updated: ${email}`);
        return user;
    }

    if (existingProvider) {
        const user = await prisma.user.update({
            where: { id: existingProvider.id },
            data: {
                ...baseData,
                emailVerifiedAt: new Date()
            }
        });
        console.log(`♻️  Dev account moved to tenant admin: ${email}`);
        return user;
    }

    const user = await prisma.user.create({
        data: {
            ...baseData,
            emailVerifiedAt: new Date()
        }
    });
    console.log(`✅ Dev tenant admin created: ${email}`);
    return user;
}

export async function seedTestUser() {
    if (env.NODE_ENV === "production" || !env.SEED_TEST_USER) {
        return null;
    }

    const users = [];

    // Default super admin is handled by ensureDefaultSuperAdmin() (keeps changed passwords).
    // Extra local-only provider test users may still be upserted here.
    if (env.SEED_PROVIDER_SUPER_ADMIN) {
        const superAdminRole = await resolveProviderSuperAdminRole();
        const defaultEmail = normalizeEmail(DEFAULT_SUPER_ADMIN.email);
        for (const account of PROVIDER_TEST_USERS) {
            if (normalizeEmail(account.email) === defaultEmail) {
                continue;
            }
            users.push(await upsertProviderUser(superAdminRole, account));
        }
    }

    const tenant = await ensureDemoTenant();
    const tenantRoles = await provisionTenantRoles(tenant.id);
    const adminRole =
        tenantRoles[TENANT_ROLE.ADMIN] ||
        Object.values(tenantRoles).find((role) => role.name === TENANT_ROLE.ADMIN);

    if (!adminRole) {
        throw new Error("Demo Tenant Admin role missing after provisioning");
    }

    for (const account of TENANT_ADMIN_TEST_USERS) {
        users.push(await upsertTenantAdmin(tenant.id, adminRole.id, account));
    }

    console.log(`✅ Demo workspace ready: ${tenant.slug} (${tenant.id})`);
    return users;
}

export default seedTestUser;
