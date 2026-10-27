import prisma from "../../database/prisma/client.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
    AUDIT_ACTION,
    INVITATION_STATUS,
    TENANT_STATUS,
    USER_STATUS,
    USER_TYPE
} from "../../shared/constants/system.js";
import { PROVIDER_ROLE, SUPER_ADMIN_ROLE_NAMES, TENANT_ROLE } from "../../shared/constants/roles.js";
import { resolvePlan } from "../../shared/constants/plans.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import sendVerificationEmail, {
    sendPasswordResetEmail,
    sendWelcomeEmail
} from "./auth.email.js";
import {
    comparePassword,
    generateAccessToken,
    generateRandomToken,
    generateRefreshToken,
    hashPassword,
    hashToken,
    verifyRefreshToken
} from "./auth.utils.js";
import {
    buildUserAccessProfile,
    findUserWithRole,
    getEffectivePermissionsFromUser,
    isSuperAdminUser
} from "../roles/role.service.js";
import { provisionTenantRoles, seedSystemRoles } from "../roles/seedSystemRoles.js";

/**
 * Authentication service (Postgres / Prisma, Phase-1 multi-tenancy).
 *
 * Contract notes:
 *  - Every export name from the Mongo era is preserved.
 *  - Email lookups are tenant-aware: `User.email` is unique per workspace only
 *    (`@@unique([tenantId, email])`), because Postgres treats NULLs as
 *    distinct. Whenever a caller knows the workspace it MUST pass `tenantId`
 *    so the right row is selected; without it the oldest workspace row wins and
 *    an email that exists in several workspaces is rejected as ambiguous.
 *  - Access tokens carry the PRD claim set
 *    (`sub`, `user_id`, `tenant_id`, `role_id`, `user_type`, `permissions`)
 *    so downstream guards never need a second database read.
 */

/**
 * Send an email without breaking the surrounding request in development:
 * a failed send is logged and reported as `false`. In production it rethrows.
 */
export async function safeSendEmail(sendFn, label) {
    try {
        await sendFn();
        console.info(`[auth] ${label} sent successfully`);
        return true;
    } catch (error) {
        if (env.NODE_ENV === "production") {
            throw error;
        }

        console.error(`[auth] ${label} failed in development:`, error.message);
        return false;
    }
}

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

/** Drop secrets before a user row is handed to the API layer. */
function sanitizeUser(user) {
    if (!user) {
        return null;
    }

    const { passwordHash, ...rest } = user;

    return rest;
}

/** Lower-cased, trimmed email used for every lookup and write. */
function normalizeEmail(email) {
    return String(email || "").toLowerCase().trim();
}

/**
 * JWT claims for a hydrated user (loaded with `USER_ROLE_INCLUDE`).
 * `sub` is kept alongside `user_id` for backward compatibility.
 */
function buildAuthPayload(user) {
    return {
        sub: user.id,
        user_id: user.id,
        email: user.email,
        user_type: user.userType,
        tenant_id: user.tenantId ?? null,
        role_id: user.role?.id ?? user.roleId ?? null,
        is_super_admin: isSuperAdminUser(user),
        permissions: getEffectivePermissionsFromUser(user)
    };
}

/** Hydrate a user + its access profile into the API shape. */
async function attachAccessProfile(userOrId) {
    const userId = typeof userOrId === "string" ? userOrId : userOrId?.id;
    const hydratedUser = await findUserWithRole(userId);

    if (!hydratedUser) {
        throw new AppError("User not found", 404);
    }

    return {
        ...sanitizeUser(hydratedUser),
        ...buildUserAccessProfile(hydratedUser)
    };
}

/**
 * Resolve the provider super-admin role, seeding the identity layer first.
 * Accepts the legacy `"Super Admin"` name so a Mongo-era database keeps
 * working after the cutover.
 */
async function ensureSuperAdminRole() {
    await seedSystemRoles();

    const existingRole = await prisma.role.findFirst({
        where: { tenantId: null, name: { in: [...SUPER_ADMIN_ROLE_NAMES] } },
        orderBy: { createdAt: "asc" }
    });

    if (existingRole) {
        return existingRole;
    }

    return prisma.role.create({
        data: {
            tenantId: null,
            name: PROVIDER_ROLE.SUPER_ADMIN,
            description:
                "Help Centre Pro platform operator - provisions and manages tenants",
            isSystem: true
        }
    });
}
/** Whether the platform already has a provider super admin (bootstrap gate). */
export async function getPlatformStatus() {
    const superAdminRole = await ensureSuperAdminRole();
    const existingSuperAdmin = await prisma.user.findFirst({
        where: { roleId: superAdminRole.id, userType: USER_TYPE.PROVIDER },
        select: { id: true, email: true, firstName: true }
    });

    return {
        bootstrapped: Boolean(existingSuperAdmin),
        adminSignInPath: "/admin/login"
    };
}

function slugifyWorkspace(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
}

function splitFullName(fullName) {
    const parts = String(fullName || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
        return { firstName: "User", lastName: "Account" };
    }

    if (parts.length === 1) {
        return { firstName: parts[0], lastName: parts[0] };
    }

    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(" ")
    };
}

async function allocateUniqueSlug(baseSlug) {
    const root = slugifyWorkspace(baseSlug) || "workspace";
    let candidate = root;
    let attempt = 0;

    while (attempt < 25) {
        const existing = await prisma.tenant.findFirst({
            where: { slug: candidate },
            select: { id: true }
        });
        if (!existing) {
            return candidate;
        }
        attempt += 1;
        candidate = `${root}-${attempt + 1}`;
    }

    return `${root}-${Date.now().toString(36)}`;
}

function workspaceSignInLink() {
    return `${String(env.FRONTEND_URL || "").replace(/\/$/, "")}/login`;
}

async function sendWorkspaceWelcome({ to, firstName }) {
    return safeSendEmail(
        () =>
            sendWelcomeEmail({
                to,
                firstName,
                signInLink: workspaceSignInLink()
            }),
        "welcome email"
    );
}

/**
 * Issue a fresh email-verification token and send the verification mail.
 */
async function issueAndSendVerification(user) {
    const rawVerificationToken = generateRandomToken();

    await prisma.verificationToken.create({
        data: {
            userId: user.id,
            tokenHash: hashToken(rawVerificationToken),
            expiresAt: new Date(Date.now() + ONE_HOUR_IN_MS)
        }
    });

    const emailSent = await safeSendEmail(
        () =>
            sendVerificationEmail({
                to: user.email,
                firstName: user.firstName,
                token: rawVerificationToken
            }),
        "verification email"
    );

    return {
        emailSent,
        ...(env.NODE_ENV !== "production"
            ? { verificationToken: rawVerificationToken }
            : {})
    };
}

/**
 * Finish signup for an incomplete account (invited / unverified).
 * Unverified self-serve accounts keep emailVerified=false and get a new link.
 */
async function claimExistingWorkspaceAccount(existingUser, { firstName, lastName, password }) {
    const passwordHash = await hashPassword(password);
    const needsEmailVerification = !existingUser.emailVerified;

    if (existingUser.tenantId) {
        await prisma.tenant.updateMany({
            where: {
                id: existingUser.tenantId,
                status: TENANT_STATUS.PROVISIONING
            },
            data: { status: TENANT_STATUS.ACTIVE }
        });
    }

    const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
            firstName,
            lastName,
            passwordHash,
            status: USER_STATUS.ACTIVE,
            emailVerified: needsEmailVerification ? false : true,
            emailVerifiedAt: needsEmailVerification
                ? existingUser.emailVerifiedAt
                : existingUser.emailVerifiedAt ?? new Date(),
            mustChangePassword: false,
            userType: existingUser.tenantId ? USER_TYPE.TENANT : existingUser.userType
        }
    });

    /** A pre-verification retry can change the password: keep the seat in step. */
    await syncPlatformOwnerPassword(user, { passwordHash });

    if (existingUser.tenantId && !needsEmailVerification) {
        await prisma.agentInvitation.updateMany({
            where: {
                userId: user.id,
                status: INVITATION_STATUS.PENDING
            },
            data: { status: INVITATION_STATUS.ACCEPTED }
        });
    }

    const tenant = user.tenantId
        ? await prisma.tenant.findUnique({
              where: { id: user.tenantId },
              select: { id: true, name: true, slug: true }
          })
        : null;

    let emailSent = false;
    let verificationToken = null;

    if (needsEmailVerification) {
        const issued = await issueAndSendVerification(user);
        emailSent = issued.emailSent;
        verificationToken = issued.verificationToken || null;
    } else {
        emailSent = await sendWorkspaceWelcome({
            to: user.email,
            firstName: user.firstName
        });
    }

    await recordAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        action: AUDIT_ACTION.USER_REGISTERED,
        entity: "User",
        entityId: user.id,
        metadata: {
            email: user.email,
            registrationType: "workspace_self_serve_claim",
            needsEmailVerification
        }
    });

    return {
        emailSent,
        claimed: true,
        email: user.email,
        ...(verificationToken ? { verificationToken } : {}),
        workspace: tenant,
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
        }
    };
}

/**
 * Keep the platform owner's provider identity on the same password.
 *
 * The bootstrap signup gives the founder a second, provider-scope row for the
 * same address (see `grantPlatformOwnershipToFirstSignup`), and "the same
 * credentials open /admin" only holds while both rows carry the same hash.
 * Workspace-side password writes are therefore replayed onto that sibling row,
 * and its live Admin Portal sessions are revoked with it.
 *
 * The sync is deliberately one-way: one address may be an unrelated admin in a
 * different workspace, so provider writes never cascade into tenant rows.
 */
async function syncPlatformOwnerPassword(user, { passwordHash, emailVerifiedAt = null }) {
    if (!user?.tenantId || !user.email) {
        return false;
    }

    const platformOwner = await prisma.user.findFirst({
        where: {
            email: user.email,
            tenantId: null,
            userType: USER_TYPE.PROVIDER
        },
        select: { id: true }
    });

    if (!platformOwner) {
        return false;
    }

    await prisma.user.update({
        where: { id: platformOwner.id },
        data: {
            passwordHash,
            ...(emailVerifiedAt
                ? { emailVerified: true, emailVerifiedAt }
                : {})
        }
    });

    await revokeUserSessions(platformOwner.id);

    return true;
}

/**
 * Give the very first self-serve signup the platform super-admin seat.
 *
 * A brand-new platform has no provider operator yet, so the person who creates
 * the first workspace also owns HelpCentre Pro. A second, provider-scope
 * identity is created for the same email/password on purpose:
 *  - `requireProviderScope` fail-closes on any workspace binding, so the tenant
 *    row can never open the Admin Portal;
 *  - `User.email` is unique per workspace only (`@@unique([tenantId, email])`),
 *    so one address can exist in both scopes;
 *  - `resolveLoginUser` already prefers the provider row for Admin Portal
 *    sign-ins (`x-portal: admin`) and the workspace row inside a workspace.
 *
 * Returns the created provider account, or `null` when the platform is already
 * bootstrapped (there is a provider super admin) or this is not the first
 * workspace - signup then behaves exactly as before.
 */
async function grantPlatformOwnershipToFirstSignup({
    tenant,
    email,
    passwordHash,
    firstName,
    lastName
}) {
    const superAdminRole = await ensureSuperAdminRole();

    const existingSuperAdmin = await prisma.user.findFirst({
        where: { roleId: superAdminRole.id, userType: USER_TYPE.PROVIDER },
        select: { id: true }
    });

    if (existingSuperAdmin) {
        return null;
    }

    /** Only the workspace that opened the platform may claim the seat. */
    const otherWorkspaces = await prisma.tenant.count({
        where: { id: { not: tenant.id } }
    });

    if (otherWorkspaces > 0) {
        return null;
    }

    const existingProviderAccount = await prisma.user.findFirst({
        where: { email, tenantId: null },
        select: { id: true }
    });

    if (existingProviderAccount) {
        return null;
    }

    const platformOwner = await prisma.user.create({
        data: {
            tenantId: null,
            userType: USER_TYPE.PROVIDER,
            email,
            passwordHash,
            firstName,
            lastName,
            roleId: superAdminRole.id,
            status: USER_STATUS.ACTIVE,
            /**
             * Mirrors the workspace row: the seat is reserved at signup but stays
             * locked until the address is proven. `verifyEmailToken` flips both
             * rows together, so `loginUser`'s "verify your email" gate still
             * protects the Admin Portal.
             */
            emailVerified: false,
            emailVerifiedAt: null,
            mustChangePassword: false,
            profileCompleted: true,
            deniedPermissions: []
        },
        select: { id: true, email: true }
    });

    await recordAuditLog({
        tenantId: null,
        userId: platformOwner.id,
        action: AUDIT_ACTION.ROLE_ASSIGNED,
        entity: "User",
        entityId: platformOwner.id,
        metadata: {
            roleId: superAdminRole.id,
            email,
            registrationType: "platform_bootstrap_signup",
            workspaceId: tenant.id,
            workspaceSlug: tenant.slug
        }
    });

    return platformOwner;
}

/**
 * Public self-serve signup:
 * 1) Create workspace + tenant admin (emailVerified=false)
 * 2) Send verification email
 * 3) User completes company details after verifying
 */
export async function registerWorkspaceAccount({ fullName, email, password }) {
    const normalizedEmail = normalizeEmail(email);
    const { firstName, lastName } = splitFullName(fullName);

    if (!password || String(password).length < 8) {
        throw new AppError("Password must be at least 8 characters", 400);
    }

    const matchingUsers = await prisma.user.findMany({
        where: { email: normalizedEmail },
        select: {
            id: true,
            email: true,
            tenantId: true,
            userType: true,
            status: true,
            emailVerified: true,
            emailVerifiedAt: true,
            lastLoginAt: true,
            mustChangePassword: true,
            firstName: true
        },
        orderBy: { createdAt: "asc" }
    });

    /**
     * One address can exist twice - once per scope - because the platform owner
     * keeps a workspace row plus a provider row. Workspace rows win here so the
     * founder sees the normal "account already exists" answer instead of the
     * Admin-Portal-reserved error.
     */
    const existingUser =
        matchingUsers.find((candidate) => candidate.tenantId !== null) ||
        matchingUsers[0] ||
        null;

    if (existingUser) {
        if (existingUser.userType === USER_TYPE.PROVIDER || existingUser.tenantId === null) {
            throw new AppError(
                "This email is reserved for the Admin Portal. Use a different work email.",
                409
            );
        }

        const isIncomplete =
            existingUser.status === USER_STATUS.INVITED ||
            !existingUser.emailVerified ||
            existingUser.mustChangePassword ||
            !existingUser.lastLoginAt;

        if (isIncomplete) {
            return claimExistingWorkspaceAccount(existingUser, {
                firstName,
                lastName,
                password
            });
        }

        throw new AppError(
            "An account with this email already exists. Please sign in.",
            409
        );
    }

    const domainPart = normalizedEmail.split("@")[1] || "workspace";
    const localPart = normalizedEmail.split("@")[0] || firstName;
    const companyHint = domainPart.split(".")[0];
    const workspaceName =
        companyHint &&
        !["gmail", "yahoo", "outlook", "hotmail", "icloud", "protonmail"].includes(
            companyHint.toLowerCase()
        )
            ? companyHint.charAt(0).toUpperCase() + companyHint.slice(1)
            : `${firstName}'s Workspace`;

    const slug = await allocateUniqueSlug(companyHint || localPart || firstName);
    const plan = resolvePlan("trial");
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({
        data: {
            name: workspaceName,
            slug,
            primaryDomain: `${slug}.helpcentrepro.com`,
            status: TENANT_STATUS.ACTIVE,
            plan: plan.key,
            seatLimit: plan.seatLimit,
            settings: {
                trial: true,
                mrr: plan.mrr,
                selfServe: true,
                ownerEmail: normalizedEmail
            }
        }
    });

    const roles = await provisionTenantRoles(tenant.id);
    const adminRole = roles[TENANT_ROLE.ADMIN];

    if (!adminRole) {
        throw new AppError("Failed to provision workspace admin role", 500);
    }

    const user = await prisma.user.create({
        data: {
            tenantId: tenant.id,
            userType: USER_TYPE.TENANT,
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
            roleId: adminRole.id,
        status: USER_STATUS.ACTIVE,
            emailVerified: false,
        mustChangePassword: false,
            profileCompleted: false,
        deniedPermissions: []
        }
    });

    const issued = await issueAndSendVerification(user);

    /**
     * A brand-new platform is owned by whoever creates its first workspace, so
     * the founder can open the Admin Portal with the same credentials.
     */
    const platformOwner = await grantPlatformOwnershipToFirstSignup({
        tenant,
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: user.id,
        action: AUDIT_ACTION.USER_REGISTERED,
        entity: "User",
        entityId: user.id,
        metadata: {
            email: user.email,
            registrationType: "workspace_self_serve",
            workspaceName
        }
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: user.id,
        action: AUDIT_ACTION.TENANT_PROVISIONED,
        entity: "Tenant",
        entityId: tenant.id,
        metadata: { plan: plan.key, selfServe: true }
    });

    return {
        emailSent: issued.emailSent,
        claimed: false,
        platformOwner: Boolean(platformOwner),
        email: user.email,
        ...(issued.verificationToken
            ? { verificationToken: issued.verificationToken }
            : {}),
        workspace: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        user: {
            id: user.id,
            email: user.email,
        firstName: user.firstName,
            lastName: user.lastName
        }
    };
}

/**
 * Complete company details after email verification (signup step 3).
 */
export async function completeUserProfile({
    email,
    companyName,
    website,
    timezone,
    industry,
    language,
    companySize,
    tenantId = null
}) {
    const normalizedEmail = normalizeEmail(email);

    const candidates = await prisma.user.findMany({
        where: { email: normalizedEmail },
        select: {
            id: true,
            tenantId: true,
            userType: true,
            emailVerified: true,
            profileCompleted: true
        }
    });

    if (!candidates.length) {
        throw new AppError("User not found", 404);
    }

    // The same email can exist in the provider scope and inside one or more
    // workspaces. Always prefer the row belonging to the workspace the request
    // came from, otherwise the completion flag is written to the wrong account
    // and "Company details" keeps coming back on every sign-in.
    const user =
        (tenantId &&
            candidates.find((candidate) => candidate.tenantId === tenantId)) ||
        candidates.find(
            (candidate) =>
                candidate.userType === USER_TYPE.TENANT &&
                candidate.tenantId !== null
        ) ||
        (candidates.length === 1 ? candidates[0] : null);

    if (!user) {
        throw new AppError(
            "This email belongs to several workspaces. Complete your company details from your workspace URL.",
            409
        );
    }

    if (!user.emailVerified) {
        throw new AppError("Verify your email before completing company details", 403);
    }

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            timezone,
            industry,
            language,
            companySize,
            profileCompleted: true
        }
    });

    if (user.tenantId) {
        const existing = await prisma.tenant.findUnique({
            where: { id: user.tenantId },
            select: { settings: true }
        });
        const settings =
            existing?.settings && typeof existing.settings === "object"
                ? { ...existing.settings }
                : {};

        await prisma.tenant.update({
            where: { id: user.tenantId },
            data: {
                name: companyName.trim(),
                settings: {
                    ...settings,
                    website: website || null,
                    industry,
                    timezone,
                    language,
                    companySize
                }
            }
        });
    }

    await recordAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        action: AUDIT_ACTION.USER_UPDATED,
        entity: "User",
        entityId: user.id,
        metadata: {
            profileCompleted: true,
            companyName,
            language
        }
    });

    return {
        user: sanitizeUser(updatedUser)
    };
}

/**
 * Register the initial provider super admin.
 *
 * Only provider-scope accounts (`tenantId IS NULL`) are considered, so the same
 * email may still exist inside a tenant workspace.
 */
export async function registerSuperAdmin({
    email,
    password,
    firstName,
    lastName
}) {
    const normalizedEmail = normalizeEmail(email);
    const superAdminRole = await ensureSuperAdminRole();

    const existingUser = await prisma.user.findFirst({
        where: { email: normalizedEmail, tenantId: null },
        select: { id: true }
    });

    if (existingUser) {
        throw new AppError("User with this email already exists", 409);
    }

    const existingSuperAdmin = await prisma.user.findFirst({
        where: { roleId: superAdminRole.id, userType: USER_TYPE.PROVIDER },
        select: { id: true }
    });

    if (existingSuperAdmin) {
        throw new AppError(
            "This platform already has an administrator. Sign in to the Admin Portal instead.",
            409
        );
    }

    const passwordHash = await hashPassword(password);
    const verifiedAt = new Date();

    const user = await prisma.user.create({
        data: {
            tenantId: null,
            userType: USER_TYPE.PROVIDER,
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
            roleId: superAdminRole.id,
        status: USER_STATUS.ACTIVE,
            emailVerified: true,
            emailVerifiedAt: verifiedAt,
        mustChangePassword: false,
        deniedPermissions: []
        },
        include: { role: { include: { permissions: { include: { permission: true } } } } }
    });

    const emailSent = await safeSendEmail(
        () =>
            sendWelcomeEmail({
        to: user.email,
                firstName: user.firstName
            }),
        "welcome email"
    );

    await recordAuditLog({
        tenantId: null,
        userId: user.id,
        action: AUDIT_ACTION.USER_REGISTERED,
        entity: "User",
        entityId: user.id,
        metadata: { email: user.email, registrationType: "super_admin" }
    });

    await recordAuditLog({
        tenantId: null,
        userId: user.id,
        action: AUDIT_ACTION.ROLE_ASSIGNED,
        entity: "User",
        entityId: user.id,
        metadata: {
            roleId: superAdminRole.id,
            registrationType: "super_admin"
        }
    });

    return {
        user: await attachAccessProfile(user),
        emailSent
    };
}

/** Resolve the workspace a login attempt belongs to (`tenantId` wins). */
async function resolveLoginTenant({ tenantId, tenantSlug }) {
    if (tenantId) {
        return prisma.tenant.findUnique({ where: { id: tenantId } });
    }

    if (tenantSlug) {
        return prisma.tenant.findFirst({
            where: {
                OR: [{ slug: tenantSlug }, { primaryDomain: tenantSlug }]
            }
        });
    }

    return null;
}

/** Build picker options when one email maps to several tenant users. */
async function buildAmbiguousWorkspaceError(tenantUsers) {
    const tenantIds = [
        ...new Set(tenantUsers.map((u) => u.tenantId).filter(Boolean))
    ];
    const tenants = tenantIds.length
        ? await prisma.tenant.findMany({
              where: { id: { in: tenantIds } },
              select: { id: true, name: true, slug: true, status: true }
          })
        : [];
    const byId = new Map(tenants.map((t) => [t.id, t]));
    const workspaces = tenantUsers
        .map((u) => {
            const tenant = byId.get(u.tenantId);
            if (!tenant) return null;
            return {
                tenantId: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                status: tenant.status
            };
        })
        .filter(Boolean);

    return new AppError(
        "This email belongs to several workspaces. Choose which workspace to open.",
        409,
        [{ code: "WORKSPACE_AMBIGUOUS", workspaces }]
    );
}

/**
 * Find the user behind a login attempt.
 *
 * `preferScope`:
 *  - `provider` → Admin Portal (provider rows win)
 *  - `tenant`   → workspace app (tenant rows win; avoids admin email shadowing)
 *  - unset      → legacy: provider wins when present, else single tenant row
 */
async function resolveLoginUser({
    email,
    tenantId,
    tenantSlug,
    preferScope = null
}) {
    const normalizedEmail = normalizeEmail(email);
    const tenant = await resolveLoginTenant({ tenantId, tenantSlug });

    if (tenantId || tenantSlug) {
        const scopedUser = await prisma.user.findFirst({
            where: { email: normalizedEmail, tenantId: tenant?.id ?? tenantId },
            include: { role: { include: { permissions: { include: { permission: true } } } } }
        });

        return { user: scopedUser, tenant };
    }

    const candidates = await prisma.user.findMany({
        where: { email: normalizedEmail },
        include: { role: { include: { permissions: { include: { permission: true } } } } }
    });

    if (!candidates.length) {
        return { user: null, tenant: null };
    }

    const providerUser = candidates.find((candidate) => candidate.tenantId === null);
    const tenantUsers = candidates.filter((candidate) => candidate.tenantId !== null);

    if (preferScope === "provider") {
        if (providerUser) {
            return { user: providerUser, tenant: null };
        }
    }

    if (preferScope === "tenant") {
        if (tenantUsers.length === 1) {
            const [user] = tenantUsers;
            return {
                user,
                tenant: await prisma.tenant.findUnique({ where: { id: user.tenantId } })
            };
        }
        if (tenantUsers.length > 1) {
            throw await buildAmbiguousWorkspaceError(tenantUsers);
        }
    }

    if (providerUser && preferScope !== "tenant") {
        return { user: providerUser, tenant: null };
    }

    if (tenantUsers.length > 1) {
        throw await buildAmbiguousWorkspaceError(tenantUsers);
    }

    if (tenantUsers.length === 1) {
        const [user] = tenantUsers;
        return {
            user,
            tenant: await prisma.tenant.findUnique({ where: { id: user.tenantId } })
        };
    }

    return { user: providerUser || null, tenant: null };
}
/**
 * Authenticate a user inside a workspace (or the provider portal).
 *
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} [params.deviceInfo]
 * @param {string} [params.ipAddress]
 * @param {string|null} [params.tenantId]  Workspace resolved from the request host.
 * @param {string|null} [params.tenantSlug] Fallback when only a slug is known.
 */
export async function loginUser({
    email,
    password,
    deviceInfo,
    ipAddress,
    tenantId = null,
    tenantSlug = null,
    preferScope = null,
    userId = null
}) {
    let user;
    let tenant;

    if (userId) {
        user = await prisma.user.findUnique({
            where: { id: userId },
            include: { role: { include: { permissions: { include: { permission: true } } } } }
        });
        tenant = user?.tenantId
            ? await prisma.tenant.findUnique({ where: { id: user.tenantId } })
            : null;
    } else {
        ({ user, tenant } = await resolveLoginUser({
            email,
            tenantId,
            tenantSlug,
            preferScope
        }));
    }

    if (!user) {
        throw new AppError("Invalid email or password", 401);
    }

    if (tenant?.status === TENANT_STATUS.SUSPENDED) {
        throw new AppError("This workspace has been suspended", 403);
    }

    // Invited / unverified tenant accounts must finish activation first.
    if (
        user.userType === USER_TYPE.TENANT &&
        (user.status === USER_STATUS.INVITED || !user.emailVerified)
    ) {
        throw new AppError(
            "Open your invitation email link, create your password, then sign in.",
            403
        );
    }

    if (!user.passwordHash) {
            throw new AppError(
            "Finish creating your account on the Sign up page, then sign in.",
                403
            );
        }

    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
        throw new AppError("Invalid email or password", 401);
    }

    if (!user.emailVerified) {
        throw new AppError("Please verify your email before logging in", 403);
    }

    if (user.status !== USER_STATUS.ACTIVE) {
        throw new AppError("User account is not active", 403);
    }

    const payload = buildAuthPayload(user);
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const refreshTokenHash = hashToken(refreshToken);

    await prisma.session.create({
        data: {
            userId: user.id,
            tenantId: user.tenantId ?? null,
            deviceInfo: deviceInfo ?? null,
            ipAddress: ipAddress ?? null,
        refreshTokenHash,
            expiresAt: new Date(Date.now() + SEVEN_DAYS_IN_MS)
        }
    });

    const loginTime = new Date();

    // Anyone who has signed in before has already seen their workspace, so the
    // "Company details" step must never come back for them. Legacy rows
    // (invited teammates, signups that never finished) can still carry
    // `profileCompleted: false`, so repair the flag while we stamp the login —
    // a single write, no extra round trip.
    const profileCompletedBackfilled =
        Boolean(user.lastLoginAt) && !user.profileCompleted;

    await prisma.user.update({
        where: { id: user.id },
        data: {
            lastLoginAt: loginTime,
            lastSeenAt: loginTime,
            isOnline: true,
            ...(profileCompletedBackfilled ? { profileCompleted: true } : {})
        }
    });

    await recordAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        action: AUDIT_ACTION.LOGIN_SUCCESS,
        entity: "Session",
        metadata: { ipAddress, deviceInfo, profileCompletedBackfilled }
    });

    return {
        user: await attachAccessProfile(user.id),
        accessToken,
        refreshToken
    };
}

async function issueSessionForUser(user, { deviceInfo, ipAddress } = {}) {
    const payload = buildAuthPayload(user);
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const refreshTokenHash = hashToken(refreshToken);

    await prisma.session.create({
        data: {
            userId: user.id,
            tenantId: user.tenantId ?? null,
            deviceInfo: deviceInfo ?? null,
            ipAddress: ipAddress ?? null,
            refreshTokenHash,
            expiresAt: new Date(Date.now() + SEVEN_DAYS_IN_MS)
        }
    });

    const loginTime = new Date();
    await prisma.user.update({
        where: { id: user.id },
        data: {
            lastLoginAt: loginTime,
            lastSeenAt: loginTime,
            isOnline: true
        }
    });

    return {
        user: await attachAccessProfile(user.id),
        accessToken,
        refreshToken
    };
}

/**
 * Sign in / register with a verified Firebase (Google) ID token.
 * New accounts skip email verification and continue to company details.
 */
export async function authenticateWithFirebaseGoogle({
    idToken,
    deviceInfo,
    ipAddress
}) {
    const { verifyFirebaseIdToken } = await import("../../config/firebaseAdmin.js");
    let identity;

    try {
        identity = await verifyFirebaseIdToken(idToken);
    } catch (error) {
        if (error?.statusCode === 503) {
            throw new AppError(error.message, 503);
        }
        throw new AppError("Invalid Google sign-in token", 401);
    }

    if (!identity.emailVerified) {
        throw new AppError("Verify your Google email before continuing", 403);
    }

    const existing = await prisma.user.findFirst({
        where: { email: identity.email },
        include: {
            role: { include: { permissions: { include: { permission: true } } } }
        }
    });

    if (existing) {
        if (existing.userType === USER_TYPE.PROVIDER || existing.tenantId === null) {
            throw new AppError(
                "This email is reserved for the Admin Portal. Use a different Google account.",
                409
            );
        }

        if (existing.status !== USER_STATUS.ACTIVE && existing.status !== USER_STATUS.INVITED) {
            throw new AppError("User account is not active", 403);
        }

        const meta =
            existing.metadata && typeof existing.metadata === "object"
                ? { ...existing.metadata }
                : {};

        // A Google account that has signed in before is already onboarded, so
        // repair the flag on the way in — company details never reappear.
        const isReturningUser = Boolean(existing.lastLoginAt);

        await prisma.user.update({
            where: { id: existing.id },
            data: {
                emailVerified: true,
                emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
                status: USER_STATUS.ACTIVE,
                mustChangePassword: false,
                profileImage: existing.profileImage || identity.picture || null,
                ...(isReturningUser && !existing.profileCompleted
                    ? { profileCompleted: true }
                    : {}),
                metadata: {
                    ...meta,
                    authProvider: "google",
                    firebaseUid: identity.uid
                }
            }
        });

        const hydrated = await findUserWithRole(existing.id);
        const session = await issueSessionForUser(hydrated, { deviceInfo, ipAddress });

        await recordAuditLog({
            tenantId: existing.tenantId,
            userId: existing.id,
            action: AUDIT_ACTION.LOGIN_SUCCESS,
            entity: "Session",
            metadata: {
                provider: "google",
                ipAddress,
                deviceInfo,
                profileCompletedBackfilled:
                    isReturningUser && !existing.profileCompleted
            }
        });

        return {
            ...session,
            isNewUser: false,
            needsProfileSetup:
                !Boolean(existing.profileCompleted) && !isReturningUser
        };
    }

    const { firstName, lastName } = splitFullName(identity.name || identity.email.split("@")[0]);
    const domainPart = identity.email.split("@")[1] || "workspace";
    const localPart = identity.email.split("@")[0] || firstName;
    const companyHint = domainPart.split(".")[0];
    const workspaceName =
        companyHint &&
        !["gmail", "yahoo", "outlook", "hotmail", "icloud", "protonmail"].includes(
            companyHint.toLowerCase()
        )
            ? companyHint.charAt(0).toUpperCase() + companyHint.slice(1)
            : `${firstName}'s Workspace`;

    const slug = await allocateUniqueSlug(companyHint || localPart || firstName);
    const plan = resolvePlan("trial");
    const passwordHash = await hashPassword(generateRandomToken());

    const tenant = await prisma.tenant.create({
        data: {
            name: workspaceName,
            slug,
            primaryDomain: `${slug}.helpcentrepro.com`,
            status: TENANT_STATUS.ACTIVE,
            plan: plan.key,
            seatLimit: plan.seatLimit,
            settings: {
                trial: true,
                mrr: plan.mrr,
                selfServe: true,
                ownerEmail: identity.email,
                authProvider: "google"
            }
        }
    });

    const roles = await provisionTenantRoles(tenant.id);
    const adminRole = roles[TENANT_ROLE.ADMIN];
    if (!adminRole) {
        throw new AppError("Failed to provision workspace admin role", 500);
    }

    const user = await prisma.user.create({
        data: {
            tenantId: tenant.id,
            userType: USER_TYPE.TENANT,
            email: identity.email,
            passwordHash,
            firstName,
            lastName,
            roleId: adminRole.id,
            status: USER_STATUS.ACTIVE,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            mustChangePassword: false,
            profileCompleted: false,
            profileImage: identity.picture || null,
            deniedPermissions: [],
            metadata: {
                authProvider: "google",
                firebaseUid: identity.uid
            }
        }
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: user.id,
        action: AUDIT_ACTION.USER_REGISTERED,
        entity: "User",
        entityId: user.id,
        metadata: {
            email: user.email,
            registrationType: "google_firebase",
            workspaceName
        }
    });

    const hydrated = await findUserWithRole(user.id);
    const session = await issueSessionForUser(hydrated, { deviceInfo, ipAddress });

    return {
        ...session,
        isNewUser: true,
        needsProfileSetup: true,
        workspace: { id: tenant.id, name: tenant.name, slug: tenant.slug }
    };
}

/** Load the user behind a refresh-token session, validating its lifecycle. */
async function loadRefreshSessionUser({ refreshToken }) {
    if (!refreshToken) {
        throw new AppError("Refresh token is required", 401);
    }

    let decoded;

    try {
        decoded = verifyRefreshToken(refreshToken);
    } catch {
        throw new AppError("Invalid or expired refresh token", 401);
    }

    const session = await prisma.session.findFirst({
        where: {
        userId: decoded.sub,
            refreshTokenHash: hashToken(refreshToken),
            isRevoked: false
        }
    });

    if (!session) {
        throw new AppError("Session not found or revoked", 401);
    }

    if (session.expiresAt < new Date()) {
        throw new AppError("Refresh token session expired", 401);
    }

    const user = await findUserWithRole(decoded.sub);

    if (!user) {
        throw new AppError("User is not authorized", 401);
    }

    if (user.tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: user.tenantId },
            select: { status: true }
        });

        if (tenant?.status === TENANT_STATUS.SUSPENDED) {
            throw new AppError("This workspace has been suspended", 403);
        }
    }

    if (!user.emailVerified) {
        throw new AppError("Please verify your email before continuing", 403);
    }

    if (user.status !== USER_STATUS.ACTIVE) {
        throw new AppError("User account is not active", 403);
    }

    return { session, user };
}

/** Rotate the refresh token and mint a fresh access token. */
export async function refreshUserToken({ refreshToken }) {
    const { session, user } = await loadRefreshSessionUser({ refreshToken });

    const payload = buildAuthPayload(user);
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    await prisma.session.update({
        where: { id: session.id },
        data: {
            refreshTokenHash: hashToken(newRefreshToken),
            expiresAt: new Date(Date.now() + SEVEN_DAYS_IN_MS)
        }
    });

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
    };
}

/** Revoke the session behind a refresh token and mark the user offline. */
export async function logoutUser({ refreshToken }) {
    const { session, user } = await loadRefreshSessionUser({ refreshToken });

    await prisma.session.update({
        where: { id: session.id },
        data: { isRevoked: true }
    });

    await prisma.user.update({
        where: { id: user.id },
        data: {
            isOnline: false,
            lastSeenAt: new Date()
        }
    });

    return true;
}
/**
 * Tenant-aware email lookup for the unauthenticated flows.
 *
 * The workspace row wins when `tenantId` is known. Without one, a workspace row
 * is still preferred over the provider row: the self-serve flows (verification,
 * password reset) must act on the identity the workspace app signs in with, and
 * `syncPlatformOwnerPassword` mirrors those writes onto the platform owner's
 * provider row. Provider rows stay reachable for Admin-Portal-only accounts.
 */
async function findUserByEmail(email, tenantId = null) {
    const normalizedEmail = normalizeEmail(email);

    if (tenantId) {
        const scopedUser = await prisma.user.findFirst({
            where: { email: normalizedEmail, tenantId }
        });

        if (scopedUser) {
            return scopedUser;
        }
    }

    const workspaceUser = await prisma.user.findFirst({
        where: { email: normalizedEmail, tenantId: { not: null } },
        orderBy: { createdAt: "asc" }
    });

    if (workspaceUser) {
        return workspaceUser;
    }

    const providerUser = await prisma.user.findFirst({
        where: { email: normalizedEmail, tenantId: null }
    });

    if (providerUser) {
        return providerUser;
    }

    return prisma.user.findFirst({ where: { email: normalizedEmail } });
}

/** Revoke every active session of a user (used on password change). */
export async function revokeUserSessions(userId, client = prisma) {
    if (!userId) {
        return 0;
    }

    const result = await client.session.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true }
    });

    return result?.count ?? 0;
}

/**
 * Revoke every active session in a workspace. Called when a tenant is
 * suspended so existing tokens stop working immediately (PRD requirement).
 */
export async function revokeTenantSessions(tenantId, client = prisma) {
    if (!tenantId) {
        return 0;
    }

    const result = await client.session.updateMany({
        where: { tenantId, isRevoked: false },
        data: { isRevoked: true }
    });

    return result?.count ?? 0;
}

/** Current user with its resolved role/permissions (used by `GET /auth/me`). */
export async function getCurrentUser(userId) {
    return attachAccessProfile(userId);
}

/** Save the agent's handset number used for outbound call bridging. */
export async function updateCurrentUserPhone(userId, phoneNumber) {
    const trimmed = phoneNumber ? String(phoneNumber).trim() : null;
    await prisma.user.update({
        where: { id: userId },
        data: { phoneNumber: trimmed || null }
    });
    return attachAccessProfile(userId);
}

/** Save the agent's sender email used for outbound customer emails (Resend). */
export async function updateCurrentUserSenderEmail(userId, senderEmail) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true }
    });
    const metadata =
        user?.metadata && typeof user.metadata === "object" && !Array.isArray(user.metadata)
            ? user.metadata
            : {};
    const normalized = senderEmail
        ? String(senderEmail).trim().toLowerCase()
        : null;

    await prisma.user.update({
        where: { id: userId },
        data: {
            metadata: {
                ...metadata,
                senderEmail: normalized
            }
        }
    });
    return attachAccessProfile(userId);
}

/** Poll whether an email has been verified yet (signup check-email helper). */
export async function getEmailVerificationStatus({ email, tenantId = null }) {
    const user = await findUserByEmail(email, tenantId);

    if (!user) {
        return { verified: false, profileCompleted: false };
    }

    return {
        verified: Boolean(user.emailVerified),
        mustChangePassword: Boolean(user.mustChangePassword),
        profileCompleted: Boolean(user.profileCompleted),
        status: user.status,
        email: user.email,
        language: user.language || null
    };
}

/** Re-send the verification email. Never reveals whether the email exists. */
export async function resendVerificationEmail({ email, tenantId = null }) {
    const user = await findUserByEmail(email, tenantId);

    if (!user || user.emailVerified) {
        return { emailSent: true };
    }

    const rawVerificationToken = generateRandomToken();

    await prisma.verificationToken.create({
        data: {
            userId: user.id,
            tokenHash: hashToken(rawVerificationToken),
            expiresAt: new Date(Date.now() + ONE_HOUR_IN_MS)
        }
    });

    const emailSent = await safeSendEmail(
        () => sendVerificationEmail({
            to: user.email,
            firstName: user.firstName,
            token: rawVerificationToken
        }),
        "verification email"
    );

    return {
        emailSent,
        ...(env.NODE_ENV !== "production"
            ? { verificationToken: rawVerificationToken }
            : {})
    };
}

/**
 * Consume an email-verification token.
 *
 * When the account was created by an invitation (`mustChangePassword`), a fresh
 * password-setup token is issued so the invitee can choose their own password.
 */
export async function verifyEmailToken({ token }) {
    const verificationRecord = await prisma.verificationToken.findFirst({
        where: { tokenHash: hashToken(token), usedAt: null }
    });

    if (!verificationRecord) {
        throw new AppError("Invalid verification token", 400);
    }

    if (verificationRecord.expiresAt < new Date()) {
        throw new AppError("Verification token expired", 400);
    }

    const user = await prisma.user.findUnique({
        where: { id: verificationRecord.userId }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const now = new Date();

    await prisma.user.update({
        where: { id: user.id },
        data: {
            emailVerified: true,
            emailVerifiedAt: user.emailVerifiedAt ?? now
        }
    });

    /**
     * The platform owner keeps a second, provider-scope row for the same address
     * (see `grantPlatformOwnershipToFirstSignup`). Verifying the workspace row
     * proves the address, so unlock the Admin Portal seat in the same step.
     */
    if (user.tenantId) {
        await prisma.user.updateMany({
            where: { email: user.email, tenantId: null, emailVerified: false },
            data: { emailVerified: true, emailVerifiedAt: now }
        });
    }

    await prisma.verificationToken.update({
        where: { id: verificationRecord.id },
        data: { usedAt: now }
    });

    const requiresPasswordSetup = Boolean(user.mustChangePassword);
    let passwordSetupToken = null;

    if (requiresPasswordSetup) {
        passwordSetupToken = generateRandomToken();

        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash: hashToken(passwordSetupToken),
                expiresAt: new Date(Date.now() + ONE_HOUR_IN_MS)
            }
        });
    }

    return {
        emailVerified: true,
        mustChangePassword: requiresPasswordSetup,
        requiresPasswordSetup,
        passwordSetupToken,
        email: user.email,
        profileCompleted: Boolean(user.profileCompleted),
        language: user.language || null
    };
}
/** Issue a password-reset token. Never reveals whether the email exists. */
export async function requestPasswordReset({ email, tenantId = null }) {
    const user = await findUserByEmail(email, tenantId);

    if (!user) {
        return { emailSent: true };
    }

    const rawToken = generateRandomToken();

    await prisma.passwordResetToken.create({
        data: {
            userId: user.id,
            tokenHash: hashToken(rawToken),
            expiresAt: new Date(Date.now() + ONE_HOUR_IN_MS)
        }
    });

    const emailSent = await safeSendEmail(
        () => sendPasswordResetEmail({
        to: user.email,
            firstName: user.firstName,
            token: rawToken
        }),
        "password reset email"
    );

    return {
        emailSent,
        ...(env.NODE_ENV !== "production" ? { resetToken: rawToken } : {})
    };
}

/**
 * Complete a password reset from an emailed token.
 *
 * Every session is revoked afterwards so a stolen token cannot be replayed
 * and any pre-existing session is invalidated.
 */
export async function resetPassword({ token, password, confirmPassword }) {
    if (password !== confirmPassword) {
        throw new AppError("Passwords do not match", 400);
    }

    const resetRecord = await prisma.passwordResetToken.findFirst({
        where: { tokenHash: hashToken(token), usedAt: null }
    });

    if (!resetRecord) {
        throw new AppError("Invalid or expired reset token", 400);
    }

    if (resetRecord.expiresAt < new Date()) {
        throw new AppError("Reset token has expired", 400);
    }

    const user = await prisma.user.findUnique({
        where: { id: resetRecord.userId }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash,
            mustChangePassword: false,
            passwordChangedAt: now,
            emailVerified: true,
            emailVerifiedAt: user.emailVerifiedAt ?? now
        }
    });

    await syncPlatformOwnerPassword(user, {
        passwordHash,
        emailVerifiedAt: user.emailVerifiedAt ?? now
    });

    await prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: now }
    });

    await revokeUserSessions(user.id);

    await recordAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        action: AUDIT_ACTION.PASSWORD_RESET,
        entity: "User",
        entityId: user.id
    });

    return true;
}

/**
 * Change the password of an authenticated user.
 *
 * Invited users (`mustChangePassword`) go through `resetPassword` instead, so
 * the current password is always required here.
 */
export async function changePassword({
    userId,
    currentPassword,
    newPassword,
    confirmPassword
}) {
    if (newPassword !== confirmPassword) {
        throw new AppError("Passwords do not match", 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const isCurrentPasswordValid = await comparePassword(
        currentPassword,
        user.passwordHash
    );

    if (!isCurrentPasswordValid) {
        throw new AppError("Current password is incorrect", 401);
    }

    const isSamePassword = await comparePassword(newPassword, user.passwordHash);

    if (isSamePassword) {
        throw new AppError(
            "New password must be different from the current password",
            400
        );
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash,
            mustChangePassword: false,
            passwordChangedAt: new Date()
        }
    });

    await syncPlatformOwnerPassword(user, { passwordHash });

    await revokeUserSessions(user.id);

    await recordAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        action: AUDIT_ACTION.PASSWORD_CHANGED,
        entity: "User",
        entityId: user.id
    });

    return true;
}




