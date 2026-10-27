import successResponse from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
    changePassword,
    completeUserProfile,
    getCurrentUser,
    getEmailVerificationStatus,
    getPlatformStatus,
    loginUser,
    logoutUser,
    refreshUserToken,
    registerWorkspaceAccount,
    requestPasswordReset,
    resendVerificationEmail,
    resetPassword,
    updateCurrentUserPhone,
    updateCurrentUserSenderEmail,
    verifyEmailToken,
} from "./auth.service.js";
import { setAuthCookies, clearAuthCookies } from "./auth.cookie.js";

/**
 * Workspace resolved by the tenant middleware for this request.
 *
 * Unauthenticated endpoints have no `req.tenantId` yet, so the resolved host
 * (`req.tenant`) is the only trustworthy source there.
 */
function requestTenantId(req) {
    return req.tenant?.id ?? req.tenantId ?? null;
}


export async function platformStatus(req, res) {
    const result = await getPlatformStatus();
    return successResponse(res, "Platform status", result);
}

export async function registerInitialSuperAdmin() {
    // Public bootstrap is disabled — admins are seeded / provisioned in-dashboard only.
    throw new AppError(
        "Admin accounts cannot be created from the sign-in page. Use the Admin Portal after signing in.",
        403
    );
}

export async function registerWorkspace(req, res) {
    const result = await registerWorkspaceAccount(req.validatedBody);

    return successResponse(
        res,
        result.claimed
            ? "Account updated. Please verify your email to continue."
            : "Account created. Please verify your email to continue.",
        {
            emailSent: Boolean(result.emailSent),
            claimed: Boolean(result.claimed),
            platformOwner: Boolean(result.platformOwner),
            email: result.email || result.user?.email || null,
            workspace: result.workspace,
            user: result.user,
            ...(result.verificationToken
                ? { verificationToken: result.verificationToken }
                : {})
        },
        201
    );
}

function resolvePreferScope(req) {
    const portal = String(req.headers["x-portal"] || "").toLowerCase();
    if (portal === "admin" || portal === "provider") return "provider";
    if (portal === "tenant" || portal === "app") return "tenant";

    const origin = String(req.headers.origin || "")
        .trim()
        .replace(/\/$/, "")
        .toLowerCase();
    const adminOrigin = String(process.env.ADMIN_FRONTEND_URL || "")
        .trim()
        .replace(/\/$/, "")
        .toLowerCase();
    const appOrigin = String(process.env.FRONTEND_URL || "")
        .trim()
        .replace(/\/$/, "")
        .toLowerCase();

    if (adminOrigin && origin === adminOrigin) return "provider";
    if (appOrigin && origin === appOrigin) return "tenant";
    if (origin.includes("admin")) return "provider";
    if (origin) return "tenant";
    return null;
}

export async function login(req, res) {
    const body = req.validatedBody || {};
    const result = await loginUser({
        ...body,
        // Host-resolved tenant wins; otherwise allow picker (tenantId/tenantSlug in body).
        tenantId: requestTenantId(req) || body.tenantId || null,
        tenantSlug: body.tenantSlug || null,
        deviceInfo: req.headers["user-agent"] || "unknown",
        ipAddress: req.ip,
        preferScope: resolvePreferScope(req)
    });

    setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
    });

    return successResponse(res, "Login successful", {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
    });
}

export async function refresh(req, res) {
    // Prefer httpOnly cookie; fall back to JSON body for SPA clients where
    // localhost ↔ 127.0.0.1 is cross-site and cookies are not sent.
    const refreshToken =
        req.cookies?.refreshToken ||
        req.body?.refreshToken ||
        req.validatedBody?.refreshToken ||
        null;
    const tokens = await refreshUserToken({ refreshToken });

    setAuthCookies(res, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
    });

    return successResponse(res, "Token refreshed successfully", {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
    });
}

export async function logout(req, res) {
    const refreshToken =
        req.cookies?.refreshToken ||
        req.body?.refreshToken ||
        null;

    await logoutUser({ refreshToken });
    clearAuthCookies(res);

    return successResponse(res, "Logout successful");
}

export async function me(req, res) {
    const user = await getCurrentUser(req.user.sub);

    return successResponse(res, "Current user fetched successfully", { user });
}

export async function updateMyPhone(req, res) {
    const user = await updateCurrentUserPhone(
        req.user.sub,
        req.validatedBody?.phoneNumber ?? null
    );

    return successResponse(res, "Agent phone updated", { user });
}

export async function updateMySenderEmail(req, res) {
    const user = await updateCurrentUserSenderEmail(
        req.user.sub,
        req.validatedBody?.senderEmail ?? null
    );

    return successResponse(res, "Sender email updated", { user });
}

export async function verifyEmail(req, res) {
    const result = await verifyEmailToken(req.validatedBody);

    return successResponse(res, "Email verified successfully", result);
}

export async function verificationStatus(req, res) {
    const result = await getEmailVerificationStatus({
        ...req.validatedBody,
        tenantId: requestTenantId(req)
    });

    return successResponse(res, "Verification status fetched", result);
}

export async function resendVerification(req, res) {
    const result = await resendVerificationEmail({
        ...req.validatedBody,
        tenantId: requestTenantId(req)
    });

    return successResponse(
        res,
        "If an unverified account exists for this email, a new verification link has been prepared",
        result
    );
}

export async function forgotPassword(req, res) {
    const result = await requestPasswordReset({
        ...req.validatedBody,
        tenantId: requestTenantId(req)
    });

    return successResponse(
        res,
        "If an account exists for this email, password reset instructions have been prepared",
        result
    );
}

export async function resetUserPassword(req, res) {
    await resetPassword(req.validatedBody);

    return successResponse(res, "Password reset successfully");
}

export async function updateUserPassword(req, res) {
    await changePassword({
        userId: req.user.sub,
        currentPassword: req.validatedBody.currentPassword,
        newPassword: req.validatedBody.newPassword,
        confirmPassword: req.validatedBody.confirmPassword
    });

    clearAuthCookies(res);

    return successResponse(
        res,
        "Password updated successfully. Please log in again with your new password."
    );
}

export async function completeProfile(req, res) {
    const result = await completeUserProfile({
        ...req.validatedBody,
        tenantId: requestTenantId(req)
    });

    return successResponse(
        res,
        "Profile completed successfully",
        result,
        200
    );
}