import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authRateLimiter } from "../../middleware/rateLimiter.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
    forgotPassword,
    login,
    logout,
    me,
    platformStatus,
    refresh,
    registerInitialSuperAdmin,
    resendVerification,
    resetUserPassword,
    updateUserPassword,
    verificationStatus,
    verifyEmail,
} from "./auth.controller.js";
import {
    emailOnlySchema,
    forgotPasswordSchema,
    loginSchema,
    registerSchema,
    resetPasswordSchema,
    updatePasswordSchema,
    verifyEmailSchema,
} from "./auth.validation.js";
import { requireAdminPortalOrigin } from "../tenants/tenant.middleware.js";

const authRoutes = express.Router();

/**
 * @openapi
 * /auth/platform-status:
 *   get:
 *     tags: [Auth]
 *     summary: Whether the platform admin has already been bootstrapped
 *     responses:
 *       200:
 *         description: Platform bootstrap status
 */
authRoutes.get("/platform-status", asyncHandler(platformStatus));

/**
 * @openapi
 * /auth/register-super-admin:
 *   post:
 *     tags: [Auth]
 *     summary: Register the initial super admin
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Super admin registered successfully; welcome email sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 */
authRoutes.post(
    "/register-super-admin",
    requireAdminPortalOrigin,
    validate(registerSchema),
    asyncHandler(registerInitialSuperAdmin)
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 */
authRoutes.post(
    "/login",
    authRateLimiter,
    validate(loginSchema),
    asyncHandler(login)
);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token using the httpOnly refresh token cookie
 *     security:
 *       - refreshCookieAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RefreshTokenResponse'
 */
authRoutes.post("/refresh", asyncHandler(refresh));

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout user using the httpOnly refresh token cookie
 *     security:
 *       - refreshCookieAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessageResponse'
 */
authRoutes.post("/logout", asyncHandler(logout));

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user fetched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 */
authRoutes.get("/me", requireAuth, asyncHandler(me));

/**
 * @openapi
 * /auth/update-password:
 *   patch:
 *     tags: [Auth]
 *     summary: Update the current logged-in user's password
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePasswordRequest'
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessageResponse'
 */
authRoutes.patch(
    "/update-password",
    requireAuth,
    validate(updatePasswordSchema),
    asyncHandler(updateUserPassword)
);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify user email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 example: email_verification_token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessageResponse'
 */
authRoutes.post("/verify-email", validate(verifyEmailSchema), asyncHandler(verifyEmail));

authRoutes.post(
    "/verification-status",
    authRateLimiter,
    validate(emailOnlySchema),
    asyncHandler(verificationStatus)
);

authRoutes.post(
    "/resend-verification",
    authRateLimiter,
    validate(emailOnlySchema),
    asyncHandler(resendVerification)
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@example.com
 *     responses:
 *       200:
 *         description: Password reset request accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessageResponse'
 */
authRoutes.post(
    "/forgot-password",
    authRateLimiter,
    validate(forgotPasswordSchema),
    asyncHandler(forgotPassword)
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset user password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessageResponse'
 */
authRoutes.post(
    "/reset-password",
    authRateLimiter,
    validate(resetPasswordSchema),
    asyncHandler(resetUserPassword)
);

export default authRoutes;