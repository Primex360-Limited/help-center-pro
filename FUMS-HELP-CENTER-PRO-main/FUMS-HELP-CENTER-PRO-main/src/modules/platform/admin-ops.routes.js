import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../roles/rbac.middleware.js";
import {
    requireAdminPortalOrigin,
    requireProviderScope
} from "../tenants/tenant.middleware.js";
import {
    exportAnalyticsCsvHandler,
    exportAuditCsvHandler,
    exportBillingCsvHandler,
    getAnalyticsHandler,
    getAuditLogsHandler,
    getBillingHandler,
    getPlansHandler,
    getStaffHandler,
    inviteStaffHandler,
    updateInvoiceHandler,
    updatePlanHandler,
    updateStaffHandler
} from "./admin-ops.controller.js";
import {
    auditQuerySchema,
    billingQuerySchema,
    inviteStaffSchema,
    invoiceParamSchema,
    invoiceStatusSchema,
    planParamSchema,
    staffIdParamSchema,
    staffQuerySchema,
    updatePlanSchema,
    updateStaffSchema
} from "./admin-ops.validation.js";

/**
 * Provider Super Admin operations for the Admin Portal:
 * billing ledger, editable plan catalog, platform analytics, team access and
 * the platform audit trail. Every route is Naira-only and provider-scoped.
 */
const adminOpsRoutes = express.Router();

const providerGuard = [
    requireAuth,
    requireAdminPortalOrigin,
    requireProviderScope,
    requirePermission("tenant:manage")
];

/**
 * @openapi
 * /admin/billing:
 *   get:
 *     tags: [Admin]
 *     summary: Platform billing ledger (invoices + KPI totals, Naira)
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
adminOpsRoutes.get(
    "/admin/billing",
    ...providerGuard,
    validate(billingQuerySchema, "query"),
    asyncHandler(getBillingHandler)
);

/** @openapi /admin/billing/export: { get: { tags: [Admin], summary: Export invoices as CSV } } */
adminOpsRoutes.get(
    "/admin/billing/export",
    ...providerGuard,
    validate(billingQuerySchema, "query"),
    asyncHandler(exportBillingCsvHandler)
);

/**
 * @openapi
 * /admin/billing/invoices/{invoiceId}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update an invoice status (paid / open / past_due / refunded / void)
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
adminOpsRoutes.patch(
    "/admin/billing/invoices/:invoiceId",
    ...providerGuard,
    validate(invoiceParamSchema, "params"),
    validate(invoiceStatusSchema),
    asyncHandler(updateInvoiceHandler)
);

/**
 * @openapi
 * /admin/plans:
 *   get:
 *     tags: [Admin]
 *     summary: Plan catalog, tenant distribution and Naira totals
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
adminOpsRoutes.get(
    "/admin/plans",
    ...providerGuard,
    asyncHandler(getPlansHandler)
);

/**
 * @openapi
 * /admin/plans/{planKey}:
 *   put:
 *     tags: [Admin]
 *     summary: Edit plan price, seats, limits, features or popular badge
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
adminOpsRoutes.put(
    "/admin/plans/:planKey",
    ...providerGuard,
    validate(planParamSchema, "params"),
    validate(updatePlanSchema),
    asyncHandler(updatePlanHandler)
);

/**
 * @openapi
 * /admin/analytics:
 *   get:
 *     tags: [Admin]
 *     summary: Platform analytics (MRR, ARR, ARPU, churn, mix, top accounts)
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
adminOpsRoutes.get(
    "/admin/analytics",
    ...providerGuard,
    asyncHandler(getAnalyticsHandler)
);

/** @openapi /admin/analytics/export: { get: { tags: [Admin], summary: Export analytics summary as CSV } } */
adminOpsRoutes.get(
    "/admin/analytics/export",
    ...providerGuard,
    asyncHandler(exportAnalyticsCsvHandler)
);

/**
 * @openapi
 * /admin/staff:
 *   get:
 *     tags: [Admin]
 *     summary: Platform team members (Staff and Access)
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *   post:
 *     tags: [Admin]
 *     summary: Invite a platform teammate
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
adminOpsRoutes.get(
    "/admin/staff",
    ...providerGuard,
    validate(staffQuerySchema, "query"),
    asyncHandler(getStaffHandler)
);

adminOpsRoutes.post(
    "/admin/staff",
    ...providerGuard,
    validate(inviteStaffSchema),
    asyncHandler(inviteStaffHandler)
);

/**
 * @openapi
 * /admin/staff/{userId}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update a teammate status or role label
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
adminOpsRoutes.patch(
    "/admin/staff/:userId",
    ...providerGuard,
    validate(staffIdParamSchema, "params"),
    validate(updateStaffSchema),
    asyncHandler(updateStaffHandler)
);

/**
 * @openapi
 * /admin/audit:
 *   get:
 *     tags: [Admin]
 *     summary: Platform audit trail
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
adminOpsRoutes.get(
    "/admin/audit",
    ...providerGuard,
    validate(auditQuerySchema, "query"),
    asyncHandler(getAuditLogsHandler)
);

/** @openapi /admin/audit/export: { get: { tags: [Admin], summary: Export audit trail as CSV } } */
adminOpsRoutes.get(
    "/admin/audit/export",
    ...providerGuard,
    validate(auditQuerySchema, "query"),
    asyncHandler(exportAuditCsvHandler)
);

export default adminOpsRoutes;
