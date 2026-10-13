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
 *    so the right row is selected; without it the provider-scope row wins and
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
 * Finish signup for an incomplete account (invited / unverified / never signed in).
 * Self-serve users are marked verified immediately — no email verification step.
 */
async function claimExistingWorkspaceAccount(existingUser, { firstName, lastName, password }) {
    const passwordHash = await hashPassword(password);
    const verifiedAt = new Date();

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
            emailVerified: true,
            emailVerifiedAt: existingUser.emailVerifiedAt ?? verifiedAt,
            mustChangePassword: false,
            userType: existingUser.tenantId ? USER_TYPE.TENANT : existingUser.userType
        }
    });

    // Clear pending invitations so the user is not stuck on invite activation.
    if (existingUser.tenantId) {
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

    const emailSent = await sendWorkspaceWelcome({
        to: user.email,
        firstName: user.firstName
    });

    await recordAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        action: AUDIT_ACTION.USER_REGISTERED,
        entity: "User",
        entityId: user.id,
        metadata: {
            email: user.email,
            registrationType: "workspace_self_serve_claim"
        }
    });

    return {
        emailSent,
        claimed: true,
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
 * Public self-serve signup: creates an active workspace + tenant admin.
 * No invitation / verification link — user can sign in immediately.
 */
export async function registerWorkspaceAccount({
    fullName,
    email,
    password
}) {
    const normalizedEmail = normalizeEmail(email);
    const { firstName, lastName } = splitFullName(fullName);

    const existingUser = await prisma.user.findFirst({
        where: { email: normalizedEmail },
        select: {
            id: true,
            tenantId: true,
            userType: true,
            status: true,
            emailVerified: true,
            emailVerifiedAt: true,
            lastLoginAt: true,
            mustChangePassword: true
        }
    });

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
        companyHint && !["gmail", "yahoo", "outlook", "hotmail", "icloud", "protonmail"].includes(
            companyHint.toLowerCase()
        )
            ? companyHint.charAt(0).toUpperCase() + companyHint.slice(1)
            : `${firstName}'s Workspace`;

    const slug = await allocateUniqueSlug(companyHint || localPart || firstName);
    const plan = resolvePlan("trial");
    const passwordHash = await hashPassword(password);
    const verifiedAt = new Date();

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
            emailVerified: true,
            emailVerifiedAt: verifiedAt,
            mustChangePassword: false,
            deniedPermissions: []
        }
    });

    const emailSent = await sendWorkspaceWelcome({
        to: user.email,
        firstName: user.firstName
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
        emailSent,
        claimed: false,
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

/**
 * Find the user behind a login attempt.
 *
 * Provider-scope rows win when no workspace is known; an email that exists in
 * several workspaces without a resolvable host is ambiguous and rejected.
 */
async function resolveLoginUser({ email, tenantId, tenantSlug }) {
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

    if (providerUser) {
        return { user: providerUser, tenant: null };
    }

    if (candidates.length > 1) {
        throw new AppError(
            "This email belongs to several workspaces. Sign in from your workspace URL.",
            409
        );
    }

    const [user] = candidates;

    return {
        user,
        tenant: user.tenantId
            ? await prisma.tenant.findUnique({ where: { id: user.tenantId } })
            : null
    };
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
    tenantSlug = null
}) {
    const { user, tenant } = await resolveLoginUser({ email, tenantId, tenantSlug });

    if (!user) {
        throw new AppError("Invalid email or password", 401);
    }

    if (tenant?.status === TENANT_STATUS.SUSPENDED) {
        throw new AppError("This workspace has been suspended", 403);
    }

    // Incomplete accounts should finish via signup (sets password + verifies).
    if (
        user.userType === USER_TYPE.TENANT &&
        (user.status === USER_STATUS.INVITED || !user.emailVerified)
    ) {
        throw new AppError(
            "Finish creating your account on the Sign up page, then sign in.",
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

    await prisma.user.update({
        where: { id: user.id },
        data: {
            lastLoginAt: loginTime,
            lastSeenAt: loginTime,
            isOnline: true
        }
    });

    await recordAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        action: AUDIT_ACTION.LOGIN_SUCCESS,
        entity: "Session",
        metadata: { ipAddress, deviceInfo }
    });

    return {
        user: await attachAccessProfile(user.id),
        accessToken,
        refreshToken
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
 * The workspace row wins when `tenantId` is known, then the provider row (for
 * `tenantId IS NULL` semantics), and finally any row so a tenant user is still
 * found when the request carried no resolvable host.
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

/** Poll whether an email has been verified yet (login page helper). */
export async function getEmailVerificationStatus({ email, tenantId = null }) {
    const user = await findUserByEmail(email, tenantId);

    if (!user) {
        return { verified: false };
    }

    return {
        verified: Boolean(user.emailVerified),
        mustChangePassword: Boolean(user.mustChangePassword),
        status: user.status
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
        email: user.email
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




