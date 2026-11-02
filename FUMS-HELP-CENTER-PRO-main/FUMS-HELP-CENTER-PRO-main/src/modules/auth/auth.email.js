import { Resend } from "resend";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import verifyEmailTemplate from "./emailTemplates/verifyEmail.template.js";
import welcomeEmailTemplate from "./emailTemplates/welcomeEmail.template.js";
import { inviteUserTemplate } from "./emailTemplates/inviteUser.template.js";
import { inviteTenantTemplate } from "./emailTemplates/inviteTenant.template.js";
import passwordResetTemplate from "./emailTemplates/passwordReset.template.js";
import { getBrandLogoAttachment } from "./emailTemplates/emailLayout.js";

function getResendClient() {
    if (!env.RESEND_API_KEY || env.RESEND_API_KEY.includes("placeholder")) {
        throw new AppError(
            "Email is not configured. Set a valid RESEND_API_KEY in your .env file.",
            503
        );
    }

    if (!env.EMAIL_FROM) {
        throw new AppError("EMAIL_FROM is not configured", 503);
    }

    return new Resend(env.RESEND_API_KEY);
}

async function dispatchEmail({ to, subject, html }) {
    if (!env.EMAIL_ENABLED) {
        console.warn(`[email] EMAIL_ENABLED=false — skipped sending to ${to}: ${subject}`);
        return { skipped: true };
    }

    // Microservice path: hand off to notification-service over HTTP.
    if (env.NOTIFICATION_SERVICE_URL && env.USE_NOTIFICATION_SERVICE) {
        const { sendEmailViaNotificationService } = await import(
            "../../platform/serviceClient.js"
        );
        return sendEmailViaNotificationService({
            to,
            subject,
            html,
            from: env.EMAIL_FROM
        });
    }

    const resend = getResendClient();
    const logoAttachment = getBrandLogoAttachment();
    const payload = {
        from: env.EMAIL_FROM,
        to,
        subject,
        html
    };

    if (logoAttachment) {
        payload.attachments = [logoAttachment];
    }

    const result = await resend.emails.send(payload);

    if (result?.error) {
        throw new AppError(
            result.error.message || "Failed to send email via Resend",
            502
        );
    }

    return result;
}

export async function sendVerificationEmail({ to, firstName, token }) {
    const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
    const template = verifyEmailTemplate({ firstName, verificationLink });

    return dispatchEmail({
        to,
        subject: template.subject,
        html: template.html
    });
}

function resolveAdminSignInUrl() {
    const appBase = String(env.FRONTEND_URL || "").replace(/\/$/, "");
    const adminBase = String(env.ADMIN_FRONTEND_URL || env.FRONTEND_URL || "").replace(
        /\/$/,
        ""
    );

    // Dedicated admin host (e.g. helpcentre-pro-admin.onrender.com) uses /login
    if (adminBase && adminBase !== appBase) {
        return `${adminBase}/login`;
    }

    return `${appBase}/admin/login`;
}

export async function sendWelcomeEmail({ to, firstName, signInLink }) {
    const link =
        signInLink ||
        resolveAdminSignInUrl();
    const template = welcomeEmailTemplate({ firstName, signInLink: link });

    return dispatchEmail({
        to,
        subject: template.subject,
        html: template.html
    });
}

export default sendVerificationEmail;

export async function sendInvitationEmail({
    to,
    firstName,
    token,
    roleName,
    temporaryPassword
}) {
    const invitationLink = `${env.FRONTEND_URL}/accept-invitation?token=${encodeURIComponent(token)}`;
    const template = inviteUserTemplate({
        firstName,
        invitationLink,
        roleName,
        temporaryPassword
    });

    return dispatchEmail({
        to,
        subject: template.subject,
        html: template.html
    });
}

export async function sendPasswordResetEmail({ to, firstName, token }) {
    const resetLink = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
    const template = passwordResetTemplate({ firstName, resetLink });

    return dispatchEmail({
        to,
        subject: template.subject,
        html: template.html
    });
}

export async function sendPlatformTeamInviteEmail({
    to,
    firstName,
    roleName,
    temporaryPassword
}) {
    const template = inviteUserTemplate({
        firstName,
        invitationLink: resolveAdminSignInUrl(),
        roleName,
        temporaryPassword
    });

    return dispatchEmail({
        to,
        subject: template.subject,
        html: template.html
    });
}

export async function sendTenantInvitationEmail({
    to,
    firstName,
    token,
    workspaceName,
    temporaryPassword
}) {
    const invitationLink = `${env.FRONTEND_URL}/accept-invitation?token=${encodeURIComponent(token)}`;
    const template = inviteTenantTemplate({
        firstName,
        workspaceName,
        invitationLink,
        temporaryPassword
    });

    return dispatchEmail({
        to,
        subject: template.subject,
        html: template.html
    });
}
