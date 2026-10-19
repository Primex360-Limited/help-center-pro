import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../roles/rbac.middleware.js";
import {
    requireAdminPortalOrigin,
    requireProviderScope
} from "../tenants/tenant.middleware.js";
import { getHowtoHandler, updateHowtoHandler } from "./platform-content.controller.js";

const platformContentRoutes = express.Router();

/**
 * @openapi
 * /platform/howto:
 *   get:
 *     tags: [Platform]
 *     summary: Get tenant sidebar "How it works" content
 *     description: |
 *       Returns the shared How it works card (title, body, video URL, poster, what's-new link)
 *       shown in every tenant workspace sidebar. Any authenticated user may read it.
 *       Only platform Super Admins can change it via PUT /admin/howto.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: How it works content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     howto:
 *                       $ref: '#/components/schemas/HowtoContent'
 *       401:
 *         description: Authentication required
 */
platformContentRoutes.get(
    "/platform/howto",
    requireAuth,
    asyncHandler(getHowtoHandler)
);

/**
 * @openapi
 * /admin/howto:
 *   get:
 *     tags: [Platform]
 *     summary: Get How it works settings (Super Admin)
 *     description: Platform Super Admin read of the shared How it works video settings.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: How it works content
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Provider Super Admin only
 *   put:
 *     tags: [Platform]
 *     summary: Update How it works video (Super Admin only)
 *     description: |
 *       Updates the How it works card for every tenant sidebar.
 *       Tenant admins cannot call this endpoint — provider scope is required.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HowtoContentUpdate'
 *           example:
 *             title: How it works
 *             body: Check out the new dashboard view. Pages now load faster.
 *             videoUrl: https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *             posterUrl: /howto-video-poster.jpg
 *             whatsNewUrl: https://helpcentrepro.com
 *     responses:
 *       200:
 *         description: How it works video updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     howto:
 *                       $ref: '#/components/schemas/HowtoContent'
 *       400:
 *         description: Invalid URL
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Provider Super Admin only — tenant admins are blocked
 *       503:
 *         description: PlatformSetting table missing — run migrations
 */
const adminHowtoGuards = [
    requireAuth,
    requireAdminPortalOrigin,
    requireProviderScope,
    requirePermission("tenant:manage")
];

platformContentRoutes.get(
    "/admin/howto",
    ...adminHowtoGuards,
    asyncHandler(getHowtoHandler)
);

platformContentRoutes.put(
    "/admin/howto",
    ...adminHowtoGuards,
    asyncHandler(updateHowtoHandler)
);

/** Alias for clients that only allow POST for updates. */
platformContentRoutes.post(
    "/admin/howto",
    ...adminHowtoGuards,
    asyncHandler(updateHowtoHandler)
);

export default platformContentRoutes;
