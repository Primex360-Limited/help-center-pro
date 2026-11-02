import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { toNaira } from "../../shared/utils/currency.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import { AUDIT_ACTION } from "../../shared/constants/system.js";

/**
 * Platform billing ledger.
 *
 * HelpCentre Pro has no `Invoice` table yet, so invoices are derived from the
 * subscription side of the platform: one invoice per billable month per paid
 * workspace, priced at that workspace's Naira MRR (which itself comes from the
 * editable plan catalog). The derived rows are persisted once in
 * `PlatformSetting("admin.billing")`, which makes them stable — statuses the
 * admin changes (mark paid, refund, past due) survive refreshes, and historic
 * amounts are frozen even after a plan price change.
 */

export const BILLING_SETTING_KEY = "admin.billing";

export const INVOICE_STATUS = Object.freeze({
    PAID: "paid",
    OPEN: "open",
    PAST_DUE: "past_due",
    REFUNDED: "refunded",
    VOID: "void"
});

const INVOICE_HISTORY_MONTHS = 6;
const INVOICE_ISSUE_DAY = 12;

function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function issueDateFor(monthDate, now) {
    const target = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        INVOICE_ISSUE_DAY,
        9,
        0,
        0,
        0
    );
    return target > now ? now : target;
}

function invoiceNumber(index) {
    return `INV-${1000 + index}`;
}

function normalizeLedger(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { invoices: [], lastSyncedAt: null };
    }
    const invoices = Array.isArray(value.invoices)
        ? value.invoices.filter((row) => row && row.id && row.tenantId)
        : [];
    return { invoices, lastSyncedAt: value.lastSyncedAt || null };
}

async function readLedger() {
    try {
        const row = await prisma.platformSetting.findUnique({
            where: { key: BILLING_SETTING_KEY }
        });
        return normalizeLedger(row?.value);
    } catch {
        // Table missing before migrate — behave like an empty ledger.
        return { invoices: [], lastSyncedAt: null };
    }
}

async function writeLedger(ledger, actorId = null) {
    try {
        await prisma.platformSetting.upsert({
            where: { key: BILLING_SETTING_KEY },
            create: {
                key: BILLING_SETTING_KEY,
                value: { ...ledger, currency: "NGN" },
                updatedBy: actorId || null
            },
            update: {
                value: { ...ledger, currency: "NGN" },
                updatedBy: actorId || null
            }
        });
    } catch (error) {
        throw new AppError(
            error?.message ||
                "Unable to save the billing ledger. Run database migrations and try again.",
            503
        );
    }
}

/** Builds any invoices that are missing for the current subscription base. */
function deriveInvoices(tenants, existingInvoices) {
    const existingIds = new Set(existingInvoices.map((invoice) => invoice.id));
    const now = new Date();
    const derived = [];
    let counter = existingInvoices.length;

    for (const tenant of tenants) {
        const amount = toNaira(tenant.mrr);
        if (amount <= 0) continue;

        const tenantStartedAt = tenant.createdAt ? new Date(tenant.createdAt) : now;

        for (let offset = INVOICE_HISTORY_MONTHS - 1; offset >= 0; offset -= 1) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            if (tenantStartedAt > endOfMonth(monthDate)) continue;

            const id = `${tenant.id}:${monthKey(monthDate)}`;
            if (existingIds.has(id)) continue;

            const issuedAt = issueDateFor(monthDate, now);
            const isCurrentMonth = offset === 0;
            const pastDue =
                isCurrentMonth && tenant.status && tenant.status !== "active";
            const dueAt = new Date(
                monthDate.getFullYear(),
                monthDate.getMonth(),
                INVOICE_ISSUE_DAY + 7,
                9,
                0,
                0,
                0
            );

            derived.push({
                id,
                number: invoiceNumber(counter),
                tenantId: tenant.id,
                tenantName: tenant.name,
                tenantSlug: tenant.slug,
                plan: tenant.plan,
                planLabel: tenant.planLabel,
                periodMonth: monthKey(monthDate),
                periodLabel: monthDate.toLocaleDateString("en-NG", {
                    month: "long",
                    year: "numeric"
                }),
                issuedAt: issuedAt.toISOString(),
                dueAt: (dueAt > now ? now : dueAt).toISOString(),
                amount,
                currency: "NGN",
                status: pastDue ? INVOICE_STATUS.PAST_DUE : INVOICE_STATUS.PAID,
                paidAt: pastDue ? null : issuedAt.toISOString(),
                refundedAt: null,
                updatedAt: issuedAt.toISOString(),
                source: "subscription"
            });
            existingIds.add(id);
            counter += 1;
        }
    }

    return derived;
}

/**
 * Ensures the ledger contains an invoice for every billable month of every
 * paid workspace. Safe to call on every Billing request (idempotent).
 *
 * Invoices belonging to workspaces that no longer exist are pruned, so the
 * Billing screen can never show revenue for a deleted/demo workspace.
 */
export async function syncBillingLedger(tenants = []) {
    const ledger = await readLedger();
    const liveTenantIds = new Set(tenants.map((tenant) => tenant.id));
    const keptInvoices = ledger.invoices.filter((invoice) =>
        liveTenantIds.has(invoice.tenantId)
    );
    const pruned = ledger.invoices.length - keptInvoices.length;
    const derived = deriveInvoices(tenants, keptInvoices);

    if (!derived.length && !pruned) {
        return ledger;
    }

    if (pruned > 0) {
        console.log(`[billing] Pruned ${pruned} invoice(s) for removed workspaces`);
    }

    const next = {
        invoices: [...derived, ...keptInvoices],
        lastSyncedAt: new Date().toISOString()
    };
    await writeLedger(next);
    return next;
}

/** Aggregate numbers for the Billing KPI cards. */
export function summarizeInvoices(invoices = []) {
    const summary = {
        currency: "NGN",
        invoiceCount: invoices.length,
        totalCollected: 0,
        paidCount: 0,
        outstandingAmount: 0,
        outstandingCount: 0,
        pastDueAmount: 0,
        pastDueCount: 0,
        refundedAmount: 0,
        refundedCount: 0
    };

    for (const invoice of invoices) {
        const amount = toNaira(invoice.amount);
        switch (invoice.status) {
            case INVOICE_STATUS.PAID:
                summary.totalCollected += amount;
                summary.paidCount += 1;
                break;
            case INVOICE_STATUS.PAST_DUE:
                summary.pastDueAmount += amount;
                summary.pastDueCount += 1;
                break;
            case INVOICE_STATUS.REFUNDED:
                summary.refundedAmount += amount;
                summary.refundedCount += 1;
                break;
            case INVOICE_STATUS.VOID:
                break;
            default:
                summary.outstandingAmount += amount;
                summary.outstandingCount += 1;
        }
    }

    return summary;
}

export function sortInvoices(invoices = []) {
    return invoices
        .slice()
        .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
}

/** Persisted status change (mark paid / refund / past due). */
export async function setInvoiceStatus(invoiceId, status, actorId = null) {
    const allowed = Object.values(INVOICE_STATUS);
    if (!allowed.includes(status)) {
        throw new AppError(`Unsupported invoice status "${status}"`, 400);
    }

    const ledger = await readLedger();
    const index = ledger.invoices.findIndex((invoice) => invoice.id === invoiceId);
    if (index === -1) {
        throw new AppError("Invoice not found", 404);
    }

    const now = new Date().toISOString();
    const previous = ledger.invoices[index];
    const updated = {
        ...previous,
        status,
        paidAt: status === INVOICE_STATUS.PAID ? previous.paidAt || now : null,
        refundedAt: status === INVOICE_STATUS.REFUNDED ? now : null,
        updatedAt: now
    };

    const invoices = ledger.invoices.slice();
    invoices[index] = updated;
    await writeLedger({ ...ledger, invoices }, actorId);

    await recordAuditLog({
        tenantId: updated.tenantId,
        userId: actorId,
        action: AUDIT_ACTION.INVOICE_STATUS_UPDATED,
        entity: "Invoice",
        entityId: updated.id,
        metadata: {
            invoice: updated.number,
            from: previous.status,
            to: status,
            amount: updated.amount
        }
    });

    return updated;
}

export default {
    syncBillingLedger,
    summarizeInvoices,
    setInvoiceStatus,
    sortInvoices,
    INVOICE_STATUS,
    BILLING_SETTING_KEY
};
