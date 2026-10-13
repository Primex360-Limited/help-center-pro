import successResponse from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
    changePassword,
    getCurrentUser,
    getEmailVerificationStatus,
    getPlatformStatus,
    loginUser,
    logoutUser,
    refreshUserToken,
    requestPasswordReset,
    resendVerificationEmail,
    resetPassword,
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

export async function login(req, res) {
    const result = await loginUser({
        ...req.validatedBody,
        tenantId: requestTenantId(req),
        deviceInfo: req.headers["user-agent"] || "unknown",
        ipAddress: req.ip,
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
    const refreshToken = req.cookies?.refreshToken;
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
    const refreshToken = req.cookies?.refreshToken;

    await logoutUser({ refreshToken });
    clearAuthCookies(res);

    return successResponse(res, "Logout successful");
}

export async function me(req, res) {
    const user = await getCurrentUser(req.user.sub);

    return successResponse(res, "Current user fetched successfully", { user });
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