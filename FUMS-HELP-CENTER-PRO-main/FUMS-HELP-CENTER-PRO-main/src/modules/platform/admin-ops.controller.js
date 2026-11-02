import successResponse from "../../shared/utils/apiResponse.js";
import {
    analyticsToCsv,
    auditToCsv,
    billingToCsv,
    getAnalytics,
    getAuditLogs,
    getBilling,
    getPlans,
    getStaff,
    inviteStaffMember,
    updateBillingInvoice,
    updatePlatformPlan,
    updateStaffMember
} from "./admin-ops.service.js";

function sendCsv(res, filename, csv) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
}

/* ------------------------------------------------------------------ Billing */

export async function getBillingHandler(req, res) {
    const billing = await getBilling(req.validatedQuery || {});
    return successResponse(res, "Billing fetched", billing);
}

export async function updateInvoiceHandler(req, res) {
    const invoice = await updateBillingInvoice(
        req.params.invoiceId,
        req.validatedBody.status,
        req.user.sub
    );
    return successResponse(res, "Invoice updated", invoice);
}

export async function exportBillingCsvHandler(req, res) {
    const billing = await getBilling(req.validatedQuery || {});
    return sendCsv(
        res,
        `helpcentre-pro-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
        billingToCsv(billing.invoices)
    );
}

/* -------------------------------------------------------------------- Plans */

export async function getPlansHandler(req, res) {
    const plans = await getPlans();
    return successResponse(res, "Plans fetched", plans);
}

export async function updatePlanHandler(req, res) {
    const plans = await updatePlatformPlan(
        req.params.planKey,
        req.validatedBody,
        req.user.sub
    );
    return successResponse(res, "Plan updated", plans);
}

/* ---------------------------------------------------------------- Analytics */

export async function getAnalyticsHandler(req, res) {
    const analytics = await getAnalytics();
    return successResponse(res, "Platform analytics fetched", analytics);
}

export async function exportAnalyticsCsvHandler(req, res) {
    const analytics = await getAnalytics();
    return sendCsv(
        res,
        `helpcentre-pro-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
        analyticsToCsv(analytics)
    );
}

/* -------------------------------------------------------------------- Staff */

export async function getStaffHandler(req, res) {
    const staff = await getStaff(req.validatedQuery || {}, req.user.sub);
    return successResponse(res, "Team fetched", staff);
}

export async function inviteStaffHandler(req, res) {
    const result = await inviteStaffMember(req.validatedBody, req.user.sub);
    return successResponse(res, "Invitation sent", result, 201);
}

export async function updateStaffHandler(req, res) {
    const result = await updateStaffMember(req.params.userId, req.validatedBody, req.user.sub);
    return successResponse(res, "Team member updated", result);
}

/* ---------------------------------------------------------------- Audit log */

export async function getAuditLogsHandler(req, res) {
    const rows = await getAuditLogs(req.validatedQuery || {});
    return successResponse(res, "Audit log fetched", { entries: rows });
}

export async function exportAuditCsvHandler(req, res) {
    const rows = await getAuditLogs(req.validatedQuery || {});
    return sendCsv(
        res,
        `helpcentre-pro-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
        auditToCsv(rows)
    );
}
