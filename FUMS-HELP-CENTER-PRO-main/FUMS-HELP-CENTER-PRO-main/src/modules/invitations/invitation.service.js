import Invitation from "../../database/model/invitation.model.js";
import Role from "../../database/model/role.model.js";
import User from "../../database/model/user.model.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
    AUDIT_ACTION,
    INVITATION_STATUS,
    USER_STATUS
} from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import {
    generateRandomToken,
    generateTemporaryPassword,
    hashPassword,
    hashToken
} from "../auth/auth.utils.js";
import { env } from "../../config/env.js";
import { sendInvitationEmail } from "../auth/auth.email.js";

const FORTY_EIGHT_HOURS_IN_MS = 48 * 60 * 60 * 1000;

async function findInvitationByToken(token) {
    const tokenHash = hashToken(token);

    const invitation = await Invitation.findOne({ tokenHash })
        .populate("roleId", "name description permissions")
        .populate("userId");

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
        invitation.status = INVITATION_STATUS.EXPIRED;
        await invitation.save();
        throw new AppError("Invitation token expired", 400);
    }

    return invitation;
}

function buildInvitationPayload(invitation) {
    const role = invitation.roleId;
    const user = invitation.userId;

    return {
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        expiresAt: invitation.expiresAt,
        invitationStatus: invitation.status,
        role: role
            ? {
                id: role._id,
                name: role.name,
                description: role.description,
                permissions: role.permissions || []
            }
            : null,
        user: user
            ? {
                id: user._id,
                roleId: user.roleId,
                emailVerified: user.emailVerified,
                status: user.status,
                mustChangePassword: user.mustChangePassword
            }
            : null
    };
}

export async function createInvitation({
    email,
    firstName,
    lastName,
    roleId,
    invitedBy
}) {
    const normalizedEmail = email.toLowerCase().trim();
    const role = await Role.findById(roleId);

    if (!role) {
        throw new AppError("Role not found", 404);
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    let user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

    if (user && user.status !== USER_STATUS.INVITED) {
        throw new AppError("A user with this email already exists", 409);
    }

    if (!user) {
        user = await User.create({
            email: normalizedEmail,
            passwordHash,
            firstName,
            lastName,
            roleId,
            status: USER_STATUS.INVITED,
            emailVerified: false,
            mustChangePassword: true,
            invitedBy,
            deniedPermissions: []
        });
    } else {
        user.firstName = firstName;
        user.lastName = lastName;
        user.passwordHash = passwordHash;
        user.roleId = roleId;
        user.status = USER_STATUS.INVITED;
        user.emailVerified = false;
        user.emailVerifiedAt = null;
        user.mustChangePassword = true;
        user.invitedBy = invitedBy;
        user.deniedPermissions = [];
        await user.save();
    }

    await Invitation.updateMany(
        {
            email: normalizedEmail,
            status: INVITATION_STATUS.PENDING
        },
        {
            $set: {
                status: INVITATION_STATUS.REVOKED
            }
        }
    );

    const rawToken = generateRandomToken();
    const invitation = await Invitation.create({
        userId: user._id,
        email: normalizedEmail,
        firstName,
        lastName,
        roleId,
        invitedBy,
        tokenHash: hashToken(rawToken),
        status: INVITATION_STATUS.PENDING,
        expiresAt: new Date(Date.now() + FORTY_EIGHT_HOURS_IN_MS)
    });

    try {
        await sendInvitationEmail({
            to: normalizedEmail,
            firstName,
            token: rawToken,
            roleName: role.name,
            temporaryPassword
        });
    } catch (error) {
        if (env.NODE_ENV === "production") {
            throw error;
        }

        console.warn("[invitations] email skipped in development:", error.message);
    }

    await recordAuditLog({
        userId: invitedBy,
        action: AUDIT_ACTION.USER_INVITED,
        entity: "Invitation",
        entityId: invitation._id,
        metadata: {
            email: normalizedEmail,
            roleId,
            invitedUserId: user._id
        }
    });

    const payload = invitation.toObject ? invitation.toObject() : invitation;

    return {
        ...payload,
        ...(env.NODE_ENV !== "production"
            ? {
                inviteToken: rawToken,
                temporaryPassword
            }
            : {})
    };
}

export async function previewInvitation(token) {
    const invitation = await findInvitationByToken(token);

    return buildInvitationPayload(invitation);
}

export async function acceptInvitation({ token }) {
    const invitation = await findInvitationByToken(token);
    const user = invitation.userId;

    if (!user) {
        throw new AppError("Invited user record no longer exist", 404);
    }

    if (invitation.status === INVITATION_STATUS.PENDING) {
        invitation.status = INVITATION_STATUS.ACCEPTED;
        invitation.acceptedAt = new Date();
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
        user.status = USER_STATUS.ACTIVE;
        await Promise.all([invitation.save(), user.save()]);

        await recordAuditLog({
            userId: user._id,
            action: AUDIT_ACTION.INVITATION_ACCEPTED,
            entity: "Invitation",
            entityId: invitation._id,
            metadata: { roleId: invitation.roleId?._id || invitation.roleId }
        });
    }

    return buildInvitationPayload(invitation);
}