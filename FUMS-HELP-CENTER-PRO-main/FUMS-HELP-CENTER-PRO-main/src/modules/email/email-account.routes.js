import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../roles/rbac.middleware.js";
import {
  createEmailAccountHandler,
  getEmailProvidersStatusHandler,
  getUserEmailAccountsHandler,
  getEmailAccountHandler,
  getDefaultEmailAccountHandler,
  updateEmailAccountHandler,
  deleteEmailAccountHandler,
  getOAuthUrlHandler,
  handleOAuthCallbackHandler,
  testImapConnectionHandler,
  testSmtpConnectionHandler,
  getImapFoldersHandler,
  triggerAccountSyncHandler,
  triggerManualSyncHandler,
  getWorkerStatsHandler
} from "./email-account.controller.js";
import {
  emailAccountCreateSchema,
  emailAccountUpdateSchema,
  oauthCallbackSchema,
  accountIdParamSchema
} from "./email-account.validation.js";

const emailAccountRoutes = express.Router();

/**
 * @openapi
 * /email-accounts:
 *   get:
 *     tags: [Email Accounts]
 *     summary: Get all email accounts for current user
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Email accounts retrieved successfully
 */
emailAccountRoutes.get(
  "/email-accounts",
  requireAuth,
  asyncHandler(getUserEmailAccountsHandler)
);

emailAccountRoutes.get(
  "/email-accounts/providers/status",
  requireAuth,
  asyncHandler(getEmailProvidersStatusHandler)
);

/**
 * @openapi
 * /email-accounts/default:
 *   get:
 *     tags: [Email Accounts]
 *     summary: Get default email account for current user
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Default email account retrieved successfully
 */
emailAccountRoutes.get(
  "/email-accounts/default",
  requireAuth,
  asyncHandler(getDefaultEmailAccountHandler)
);

/**
 * @openapi
 * /email-accounts:
 *   post:
 *     tags: [Email Accounts]
 *     summary: Create a new email account
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailAccountCreateRequest'
 *     responses:
 *       201:
 *         description: Email account created successfully
 */
emailAccountRoutes.post(
  "/email-accounts",
  requireAuth,
  validate(emailAccountCreateSchema),
  asyncHandler(createEmailAccountHandler)
);

/**
 * @openapi
 * /email-accounts/{accountId}:
 *   get:
 *     tags: [Email Accounts]
 *     summary: Get a specific email account
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email account retrieved successfully
 */
emailAccountRoutes.get(
  "/email-accounts/:accountId",
  requireAuth,
  validate(accountIdParamSchema, "params"),
  asyncHandler(getEmailAccountHandler)
);

/**
 * @openapi
 * /email-accounts/{accountId}:
 *   put:
 *     tags: [Email Accounts]
 *     summary: Update an email account
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailAccountUpdateRequest'
 *     responses:
 *       200:
 *         description: Email account updated successfully
 */
emailAccountRoutes.put(
  "/email-accounts/:accountId",
  requireAuth,
  validate(accountIdParamSchema, "params"),
  validate(emailAccountUpdateSchema),
  asyncHandler(updateEmailAccountHandler)
);

/**
 * @openapi
 * /email-accounts/{accountId}:
 *   delete:
 *     tags: [Email Accounts]
 *     summary: Delete an email account
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email account deleted successfully
 */
emailAccountRoutes.delete(
  "/email-accounts/:accountId",
  requireAuth,
  validate(accountIdParamSchema, "params"),
  asyncHandler(deleteEmailAccountHandler)
);

/**
 * @openapi
 * /email-accounts/oauth/{provider}/auth-url:
 *   get:
 *     tags: [Email Accounts]
 *     summary: Get OAuth authorization URL
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [gmail, outlook]
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OAuth URL generated successfully
 */
emailAccountRoutes.get(
  "/email-accounts/oauth/:provider/auth-url",
  requireAuth,
  asyncHandler(getOAuthUrlHandler)
);

/**
 * @openapi
 * /email-accounts/oauth/{provider}/callback:
 *   post:
 *     tags: [Email Accounts]
 *     summary: Handle OAuth callback
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [gmail, outlook]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OAuthCallbackRequest'
 *     responses:
 *       200:
 *         description: OAuth callback processed successfully
 */
emailAccountRoutes.post(
  "/email-accounts/oauth/:provider/callback",
  requireAuth,
  validate(oauthCallbackSchema),
  asyncHandler(handleOAuthCallbackHandler)
);

/**
 * @openapi
 * /email-accounts/{accountId}/test-imap:
 *   post:
 *     tags: [Email Accounts]
 *     summary: Test IMAP connection
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: IMAP connection test completed
 */
emailAccountRoutes.post(
  "/email-accounts/:accountId/test-imap",
  requireAuth,
  validate(accountIdParamSchema, "params"),
  asyncHandler(testImapConnectionHandler)
);

/**
 * @openapi
 * /email-accounts/{accountId}/test-smtp:
 *   post:
 *     tags: [Email Accounts]
 *     summary: Test SMTP connection
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: SMTP connection test completed
 */
emailAccountRoutes.post(
  "/email-accounts/:accountId/test-smtp",
  requireAuth,
  validate(accountIdParamSchema, "params"),
  asyncHandler(testSmtpConnectionHandler)
);

/**
 * @openapi
 * /email-accounts/{accountId}/folders:
 *   get:
 *     tags: [Email Accounts]
 *     summary: Get IMAP folders for an account
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: IMAP folders retrieved successfully
 */
emailAccountRoutes.get(
  "/email-accounts/:accountId/folders",
  requireAuth,
  validate(accountIdParamSchema, "params"),
  asyncHandler(getImapFoldersHandler)
);

/**
 * @openapi
 * /email-accounts/{accountId}/sync:
 *   post:
 *     tags: [Email Accounts]
 *     summary: Trigger manual sync for an account
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sync triggered successfully
 */
emailAccountRoutes.post(
  "/email-accounts/:accountId/sync",
  requireAuth,
  validate(accountIdParamSchema, "params"),
  asyncHandler(triggerAccountSyncHandler)
);

/**
 * @openapi
 * /email-accounts/sync-all:
 *   post:
 *     tags: [Email Accounts]
 *     summary: Trigger manual sync for all accounts
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Sync triggered successfully
 */
emailAccountRoutes.post(
  "/email-accounts/sync-all",
  requireAuth,
  asyncHandler(triggerManualSyncHandler)
);

/**
 * @openapi
 * /email-accounts/worker/stats:
 *   get:
 *     tags: [Email Accounts]
 *     summary: Get email sync worker statistics
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Worker statistics retrieved successfully
 */
emailAccountRoutes.get(
  "/email-accounts/worker/stats",
  requireAuth,
  asyncHandler(getWorkerStatsHandler)
);

export default emailAccountRoutes;
