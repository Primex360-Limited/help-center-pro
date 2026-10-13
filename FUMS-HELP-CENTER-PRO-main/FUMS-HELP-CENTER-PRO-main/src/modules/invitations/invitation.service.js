import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { env } from "../../config/env.js";
import {
    AUDIT_ACTION,
    INVITATION_STATUS,
    TENANT_STATUS,
    USER_STATUS,
    USER_TYPE
} from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import {
    generateRandomToken,
    generateTemporaryPassword,
    hashPassword,
    hashToken
} from "../auth/auth.utils.js";
import { sendInvitationEmail } from "../auth/auth.email.js";
import { safeSendEmail } from "../auth/auth.service.js";
import { buildRoleSummary } from "../roles/role.service.js";

/**
 * Agent invitation service (Postgres / Prisma, Phase-1 multi-tenancy).
 *
 * Every invitation belongs to exactly one workspace (`AgentInvitation.tenantId`
 * is required), and the invited role must live in that same workspace — so a
 * tenant admin can only ever invite into their own tenant.
 *
 * The invited user row is created immediately (status `invited`,
 * `mustChangePassword: true`) and is flipped to `active` when the invitee
 * accepts the token, mirroring the legacy Mongo behaviour.
 */

const FORTY_EIGHT_HOURS_IN_MS = 48 * 60 * 60 * 1000;

const INVITATION_INCLUDE = Object.freeze({
    role: { include: { permissions: { include: { permission: true } } } },
    user: true
});

function normalizeEmail(email) {
    return String(email || "").toLowerCase().trim();
}

/** Load a usable invitation by raw token, expiring it on the way if stale. */
async function findInvitationByToken(token, client = prisma) {
    if (!token) {
        throw new AppError("Invalid invitation token", 400);
    }

    const invitation = await client.agentInvitation.findFirst({
        where: { tokenHash: hashToken(token) },
        include: INVITATION_INCLUDE
    });

    if (!invitation) {
        throw new AppError("Invalid invitation token", 400);
    }

    if (
        invitation.status === INVITATION_STATUS.REVOKED ||
        invitation.status === INVITATION_STATUS.EXPIRED
    ) {
        throw new AppError("Invitation no longer valid", 400);
    }

    if (
        invitation.status === INVITATION_STATUS.PENDING &&
        invitation.expiresAt < new Date()
    ) {
        await client.agentInvitation.update({
            where: { id: invitation.id },
            data: { status: INVITATION_STATUS.EXPIRED }
        });

        throw new AppError("Invitation token expired", 400);
    }

    return invitation;
}

function buildInvitationPayload(invitation) {
    const user = invitation.user;

    return {
        id: invitation.id,
        tenantId: invitation.tenantId,
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        expiresAt: invitation.expiresAt,
        invitationStatus: invitation.status,
        role: buildRoleSummary(invitation.role),
        user: user
            ? {
                id: user.id,
                roleId: user.roleId,
                emailVerified: user.emailVerified,
                status: user.status,
                mustChangePassword: user.mustChangePassword
            }
            : null
    };
}

/** `tenant_admins_invited` is a workspace-level event, `user_invited` an agent one. */
async function resolveInviteAuditAction(invitedBy, client = prisma) {
    if (!invitedBy) {
        return AUDIT_ACTION.USER_INVITED;
    }

    const inviter = await client.user.findUnique({
        where: { id: invitedBy },
        select: { userType: true }
    });

    return inviter?.userType === USER_TYPE.PROVIDER
        ? AUDIT_ACTION.TENANT_ADMIN_INVITED
        : AUDIT_ACTION.USER_INVITED;
}

/**
 * Invite someone into a workspace and hand them a role.
 *
 * `tenantId` is mandatory: an agent always belongs to a workspace. A provider
 * super admin passes the workspace being provisioned, a tenant admin passes
 * their own workspace (resolved from `req.tenantId` by the controller).
 */
export async function createInvitation({
    email,
    firstName,
    lastName,
    roleId,
    invitedBy,
    tenantId = null
}) {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
        throw new AppError("Email is required", 400);
    }

    if (!tenantId) {
        throw new AppError("A workspace is required to invite a user", 400);
    }

    if (!invitedBy) {
        throw new AppError("Invitation sender could not be resolved", 400);
    }

    const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId },
        include: { permissions: { include: { permission: true } } }
    });

    if (!role) {
        throw new AppError("Role not found", 404);
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const existingUser = await prisma.user.findFirst({
        where: { tenantId, email: normalizedEmail },
        select: { id: true, status: true }
    });

    if (existingUser && existingUser.status !== USER_STATUS.INVITED) {
        throw new AppError("A user with this email already exists", 409);
    }

    const invitedUserData = {
        tenantId,
        userType: USER_TYPE.TENANT,
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        roleId: role.id,
        status: USER_STATUS.INVITED,
        emailVerified: false,
        emailVerifiedAt: null,
        mustChangePassword: true,
        invitedById: invitedBy,
        deniedPermissions: []
    };

    const user = existingUser
        ? await prisma.user.update({
              where: { id: existingUser.id },
              data: invitedUserData
          })
        : await prisma.user.create({ data: invitedUserData });

    // A fresh invite invalidates any pending invite for the same address.
    await prisma.agentInvitation.updateMany({
        where: {
            tenantId,
            email: normalizedEmail,
            status: INVITATION_STATUS.PENDING
        },
        data: {
            status: INVITATION_STATUS.REVOKED,
            revokedAt: new Date()
        }
    });

    const rawToken = generateRandomToken();
    const invitation = await prisma.agentInvitation.create({
        data: {
            tenantId,
            userId: user.id,
            email: normalizedEmail,
            firstName,
            lastName,
            roleId: role.id,
            invitedById: invitedBy,
            tokenHash: hashToken(rawToken),
            status: INVITATION_STATUS.PENDING,
            expiresAt: new Date(Date.now() + FORTY_EIGHT_HOURS_IN_MS)
        }
    });

    const emailSent = await safeSendEmail(
        () =>
            sendInvitationEmail({
                to: normalizedEmail,
                firstName,
                token: rawToken,
                roleName: role.name,
                temporaryPassword
            }),
        `invitation email to ${normalizedEmail}`
    );

    await recordAuditLog({
        tenantId,
        userId: invitedBy,
        action: await resolveInviteAuditAction(invitedBy),
        entity: "Invitation",
        entityId: invitation.id,
        metadata: {
            email: normalizedEmail,
            roleId: role.id,
            invitedUserId: user.id,
            emailSent
        }
    });

    return {
        ...invitation,
        ...(env.NODE_ENV !== "production"
            ? { inviteToken: rawToken, temporaryPassword }
            : {})
    };
}

/** Public preview of an invitation (no secrets are exposed). */
export async function previewInvitation(token) {
    const invitation = await findInvitationByToken(token);

    return buildInvitationPayload(invitation);
}

/**
 * Accept an invitation: activate the user, verify email, and set their chosen
 * password in one step so they can sign in immediately (no temp-password trap).
 *
 * Already-accepted invites may still set a password once before first login
 * (recovery when the temporary password email was lost).
 */
export async function acceptInvitation({ token, password }) {
    const invitation = await findInvitationByToken(token);

    if (!invitation.userId) {
        throw new AppError("Invited user record no longer exists", 404);
    }

    if (!password) {
        throw new AppError("Password is required to activate your account", 400);
    }

    const invitedUser = await prisma.user.findUnique({
        where: { id: invitation.userId },
        select: {
            id: true,
            email: true,
            lastLoginAt: true,
            status: true,
            emailVerified: true,
            emailVerifiedAt: true,
            mustChangePassword: true
        }
    });

    if (!invitedUser) {
        throw new AppError("Invited user record no longer exists", 404);
    }

    const alreadyAccepted = invitation.status === INVITATION_STATUS.ACCEPTED;

    if (alreadyAccepted && invitedUser.lastLoginAt) {
        throw new AppError(
            "This invitation was already activated. Please sign in with your password.",
            409
        );
    }

    const acceptedAt = new Date();
    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
        prisma.agentInvitation.update({
            where: { id: invitation.id },
            data: {
                status: INVITATION_STATUS.ACCEPTED,
                acceptedAt: invitation.acceptedAt ?? acceptedAt
            }
        }),
        prisma.user.update({
            where: { id: invitation.userId },
            data: {
                passwordHash,
                emailVerified: true,
                emailVerifiedAt: invitedUser.emailVerifiedAt ?? acceptedAt,
                status: USER_STATUS.ACTIVE,
                mustChangePassword: false
            }
        })
    ]);

    if (!alreadyAccepted) {
        await recordAuditLog({
            tenantId: invitation.tenantId,
            userId: invitation.userId,
            action: AUDIT_ACTION.INVITATION_ACCEPTED,
            entity: "Invitation",
            entityId: invitation.id,
            metadata: { roleId: invitation.roleId }
        });
    }

    if (invitation.tenantId) {
        await prisma.tenant.updateMany({
            where: {
                id: invitation.tenantId,
                status: { not: TENANT_STATUS.ACTIVE }
            },
            data: {
                status: TENANT_STATUS.ACTIVE,
                suspendedAt: null,
                suspendedReason: null
            }
        });
    }

    const accepted = await prisma.agentInvitation.findFirst({
        where: { id: invitation.id },
        include: INVITATION_INCLUDE
    });

    return buildInvitationPayload(accepted ?? invitation);
}

export default createInvitation;
