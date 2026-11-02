import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { PROVIDER_ROLE } from "../../shared/constants/roles.js";
import { USER_STATUS, USER_TYPE, AUDIT_ACTION } from "../../shared/constants/system.js";
import { formatNaira, toNaira } from "../../shared/utils/currency.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import { generateTemporaryPassword, hashPassword } from "../auth/auth.utils.js";
import { sendPlatformTeamInviteEmail } from "../auth/auth.email.js";
import { listTenants } from "../tenants/tenant.service.js";
import { getPlanCatalog, updatePlan as updatePlanCatalog } from "./plan-catalog.service.js";
import {
    INVOICE_STATUS,
    setInvoiceStatus,
    sortInvoices,
    summarizeInvoices,
    syncBillingLedger
} from "./billing-ledger.service.js";

/**
 * Provider (Super Admin) operations: billing ledger, plan catalog, platform
 * analytics, team access and the audit trail. Every money value returned here
 * is an integer amount of Naira.
 */

export const STAFF_ROLES = Object.freeze(["Owner", "Admin", "Support", "Viewer"]);

const INVOICE_STATUS_FILTERS = Object.freeze(["all", ...Object.values(INVOICE_STATUS)]);

function escapeCell(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(columns, rows) {
    const header = columns.map((column) => escapeCell(column.label)).join(",");
    const body = rows.map((row) =>
        columns.map((column) => escapeCell(column.value(row))).join(",")
    );
    return [header, ...body].join("\r\n");
}

function staffView(user, viewerId = null) {
    const metadata = user.metadata && typeof user.metadata === "object" ? user.metadata : {};
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    const initials =
        [user.firstName, user.lastName]
            .filter(Boolean)
            .map((part) => part[0])
            .join("")
            .toUpperCase() || fullName.slice(0, 2).toUpperCase();

    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName,
        initials,
        email: user.email,
        role: String(metadata.staffRole || "Owner"),
        status: user.status,
        twoFactorEnabled: Boolean(metadata.twoFactorEnabled),
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        isSelf: viewerId ? user.id === viewerId : false
    };
}

/* ------------------------------------------------------------------ Billing */

export async function getBilling({ q = "", status = "all" } = {}) {
    const filter = INVOICE_STATUS_FILTERS.includes(String(status)) ? String(status) : "all";
    const tenants = await listTenants();
    const ledger = await syncBillingLedger(tenants);
    const allInvoices = sortInvoices(ledger.invoices);
    const summary = summarizeInvoices(allInvoices);

    const query = String(q || "").trim().toLowerCase();
    const invoices = allInvoices.filter((invoice) => {
        if (filter !== "all" && invoice.status !== filter) return false;
        if (!query) return true;
        return [invoice.number, invoice.tenantName, invoice.tenantSlug, invoice.planLabel]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);
    });

    return {
        summary: { ...summary, currency: "NGN", lastSyncedAt: ledger.lastSyncedAt || null },
        invoices: invoices.map((invoice) => ({
            ...invoice,
            amountLabel: formatNaira(invoice.amount)
        })),
        filteredCount: invoices.length,
        totalCount: allInvoices.length
    };
}

export async function updateBillingInvoice(invoiceId, status, actorId = null) {
    const invoice = await setInvoiceStatus(invoiceId, status, actorId);
    return { invoice: { ...invoice, amountLabel: formatNaira(invoice.amount) } };
}

export function billingToCsv(invoices = []) {
    return toCsv(
        [
            { label: "Invoice", value: (row) => row.number },
            { label: "Tenant", value: (row) => row.tenantName },
            { label: "Plan", value: (row) => row.planLabel },
            { label: "Period", value: (row) => row.periodMonth },
            {
                label: "Issued",
                value: (row) => new Date(row.issuedAt).toISOString().slice(0, 10)
            },
            { label: "Amount (NGN)", value: (row) => toNaira(row.amount) },
            { label: "Status", value: (row) => row.status },
            {
                label: "Paid At",
                value: (row) =>
                    row.paidAt ? new Date(row.paidAt).toISOString().slice(0, 10) : ""
            }
        ],
        invoices
    );
}

/* -------------------------------------------------------------------- Plans */

function buildPlanDistribution(catalog, tenants) {
    const total = tenants.length;
    return catalog.map((plan) => {
        const members = tenants.filter((tenant) => tenant.plan === plan.key);
        const mrr = members.reduce(
            (sum, tenant) => sum + (tenant.status === "active" ? tenant.mrr : 0),
            0
        );
        return {
            key: plan.key,
            label: plan.label,
            count: members.length,
            share: total ? Math.round((members.length / total) * 100) : 0,
            mrr
        };
    });
}

export async function getPlans() {
    const [catalog, tenants] = await Promise.all([getPlanCatalog(), listTenants()]);
    const distribution = buildPlanDistribution(catalog, tenants);

    return {
        plans: catalog.filter((plan) => plan.key !== "trial"),
        trialPlan: catalog.find((plan) => plan.key === "trial") || null,
        distribution,
        totals: {
            tenants: tenants.length,
            mrr: tenants
                .filter((tenant) => tenant.status === "active" && !tenant.trial)
                .reduce((sum, tenant) => sum + tenant.mrr, 0),
            currency: "NGN"
        }
    };
}

/**
 * Edits a plan and — when the seat allowance changes — rolls the new seat
 * limit onto the workspaces on that plan.
 */
export async function updatePlatformPlan(planKey, patch, actorId = null) {
    const { plan } = await updatePlanCatalog(planKey, patch, actorId);

    if (patch?.seatLimit !== undefined) {
        await prisma.tenant.updateMany({
            where: { plan: planKey },
            data: { seatLimit: plan.seatLimit }
        });
    }

    return { plan, ...(await getPlans()) };
}

/* ---------------------------------------------------------------- Analytics */

const MONTH_LABELS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
];

function monthKeyOf(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function countBy(tenants, selector, limit = 6) {
    const buckets = new Map();
    for (const tenant of tenants) {
        const key = String(selector(tenant) || "Unassigned").trim() || "Unassigned";
        buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    const rows = [...buckets.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const max = rows[0]?.count || 1;
    return rows.slice(0, limit).map((row) => ({
        ...row,
        share: Math.round((row.count / max) * 100)
    }));
}

export async function getAnalytics() {
    const [tenants, catalog] = await Promise.all([listTenants(), getPlanCatalog()]);
    const ledger = await syncBillingLedger(tenants);

    const activeTenants = tenants.filter((tenant) => tenant.status === "active");
    const payingTenants = activeTenants.filter((tenant) => !tenant.trial && tenant.mrr > 0);
    const churnedTenants = tenants.filter((tenant) => tenant.status !== "active");

    const mrr = payingTenants.reduce((sum, tenant) => sum + tenant.mrr, 0);
    const arr = mrr * 12;
    const arpu = payingTenants.length ? Math.round(mrr / payingTenants.length) : 0;
    const churnRate = tenants.length
        ? Math.round((churnedTenants.length / tenants.length) * 1000) / 10
        : 0;

    const now = new Date();
    const paidInvoices = ledger.invoices.filter(
        (invoice) => invoice.status === INVOICE_STATUS.PAID
    );
    const revenueSixMonths = Array.from({ length: 6 }, (_, index) => {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
        const key = monthKeyOf(monthDate);
        const revenue = paidInvoices
            .filter((invoice) => invoice.periodMonth === key)
            .reduce((sum, invoice) => sum + toNaira(invoice.amount), 0);
        return { month: key, label: MONTH_LABELS[monthDate.getMonth()], revenue };
    });

    const planMixRows = catalog
        .filter((plan) => plan.key !== "trial")
        .map((plan) => {
            const count = tenants.filter((tenant) => tenant.plan === plan.key).length;
            return { key: plan.key, label: plan.label, count };
        });
    const planMixMax = Math.max(1, ...planMixRows.map((row) => row.count));

    const topAccounts = tenants
        .slice()
        .sort((a, b) => b.mrr - a.mrr || b.ticketsLast30d - a.ticketsLast30d)
        .slice(0, 5)
        .map((tenant) => ({
            id: tenant.id,
            name: tenant.name,
            planLabel: tenant.planLabel,
            mrr: tenant.mrr,
            ticketsLast30d: tenant.ticketsLast30d
        }));

    return {
        metrics: {
            mrr,
            arr,
            arpu,
            churnRate,
            churnedCount: churnedTenants.length,
            activeTenants: activeTenants.length,
            payingTenants: payingTenants.length,
            trialTenants: activeTenants.filter((tenant) => tenant.trial).length,
            totalTenants: tenants.length,
            currency: "NGN"
        },
        revenueSixMonths,
        planMix: planMixRows.map((row) => ({
            ...row,
            share: Math.round((row.count / planMixMax) * 100)
        })),
        byCountry: countBy(tenants, (tenant) => tenant.country),
        byIndustry: countBy(tenants, (tenant) => tenant.industry),
        topAccounts
    };
}

export function analyticsToCsv(analytics) {
    const rows = [
        { metric: "MRR (NGN)", value: analytics.metrics.mrr },
        { metric: "ARR (NGN)", value: analytics.metrics.arr },
        { metric: "ARPU (NGN)", value: analytics.metrics.arpu },
        { metric: "Churn rate (%)", value: analytics.metrics.churnRate },
        { metric: "Active tenants", value: analytics.metrics.activeTenants },
        { metric: "Paying tenants", value: analytics.metrics.payingTenants }
    ];
    return toCsv(
        [
            { label: "Metric", value: (row) => row.metric },
            { label: "Value", value: (row) => row.value }
        ],
        rows
    );
}

/* --------------------------------------------------------------- Team access */

async function findProviderRole() {
    return prisma.role.findFirst({
        where: { name: PROVIDER_ROLE.SUPER_ADMIN, tenantId: null },
        select: { id: true, name: true }
    });
}

export async function getStaff({ q = "" } = {}, viewerId = null) {
    const users = await prisma.user.findMany({
        where: { userType: USER_TYPE.PROVIDER },
        orderBy: { createdAt: "asc" }
    });

    const query = String(q || "").trim().toLowerCase();
    const staff = users
        .map((user) => staffView(user, viewerId))
        .filter((member) => {
            if (!query) return true;
            return [member.fullName, member.email, member.role]
                .join(" ")
                .toLowerCase()
                .includes(query);
        });

    return { staff, roles: [...STAFF_ROLES], total: staff.length };
}

export async function inviteStaffMember(payload, actorId = null) {
    const email = String(payload.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
        throw new AppError("A valid work email is required", 400);
    }

    const roleLabel = STAFF_ROLES.includes(payload.role) ? payload.role : "Admin";

    const existing = await prisma.user.findFirst({
        where: { email, userType: USER_TYPE.PROVIDER },
        select: { id: true }
    });
    if (existing) {
        throw new AppError("A platform account with this email already exists", 409);
    }

    const role = await findProviderRole();
    if (!role) {
        throw new AppError(
            "Provider Super Admin role is not provisioned. Run the role seed and try again.",
            503
        );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await prisma.user.create({
        data: {
            tenantId: null,
            userType: USER_TYPE.PROVIDER,
            email,
            passwordHash,
            firstName: String(payload.firstName || "").trim() || "Team",
            lastName: String(payload.lastName || "").trim() || "Member",
            roleId: role.id,
            status: USER_STATUS.INVITED,
            emailVerified: false,
            mustChangePassword: true,
            invitedById: actorId || null,
            metadata: { staffRole: roleLabel, twoFactorEnabled: false }
        }
    });

    let emailSent = false;
    try {
        await sendPlatformTeamInviteEmail({
            to: email,
            firstName: user.firstName,
            roleName: roleLabel,
            temporaryPassword
        });
        emailSent = true;
    } catch (error) {
        console.warn(`[admin-ops] team invite email failed for ${email}: ${error.message}`);
    }

    await recordAuditLog({
        userId: actorId,
        action: AUDIT_ACTION.USER_INVITED,
        entity: "User",
        entityId: user.id,
        metadata: { email, role: roleLabel, scope: "provider" }
    });

    return {
        staff: staffView(user, actorId),
        emailSent,
        // Returned only when the mailer is unavailable so the admin can share
        // the one-time password manually.
        temporaryPassword: emailSent ? undefined : temporaryPassword
    };
}

export async function updateStaffMember(userId, patch = {}, actorId = null) {
    const user = await prisma.user.findFirst({
        where: { id: userId, userType: USER_TYPE.PROVIDER }
    });
    if (!user) throw new AppError("Team member not found", 404);

    const nextStatus = patch.status ? String(patch.status).toLowerCase() : null;
    if (nextStatus && ![USER_STATUS.ACTIVE, USER_STATUS.INACTIVE].includes(nextStatus)) {
        throw new AppError("Status must be active or inactive", 400);
    }

    if (actorId && user.id === actorId && nextStatus && nextStatus !== USER_STATUS.ACTIVE) {
        throw new AppError("You cannot disable your own platform account", 400);
    }

    if (nextStatus && nextStatus !== USER_STATUS.ACTIVE) {
        const remaining = await prisma.user.count({
            where: {
                userType: USER_TYPE.PROVIDER,
                status: USER_STATUS.ACTIVE,
                id: { not: user.id }
            }
        });
        if (remaining === 0) {
            throw new AppError("At least one active platform administrator must remain", 400);
        }
    }

    const nextRole = patch.role && STAFF_ROLES.includes(patch.role) ? patch.role : null;
    const metadata = {
        ...(user.metadata && typeof user.metadata === "object" ? user.metadata : {}),
        ...(nextRole ? { staffRole: nextRole } : {})
    };

    const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
            ...(nextStatus ? { status: nextStatus } : {}),
            metadata
        }
    });

    await recordAuditLog({
        userId: actorId,
        action: AUDIT_ACTION.USER_STATUS_UPDATED,
        entity: "User",
        entityId: user.id,
        metadata: {
            email: user.email,
            status: nextStatus || user.status,
            role: nextRole || staffView(user).role
        }
    });

    return { staff: staffView(updated, actorId) };
}

/* ----------------------------------------------------------------- Audit log */

export async function getAuditLogs({ q = "", limit = 120 } = {}) {
    const take = Math.min(Math.max(Number(limit) || 120, 1), 300);
    const rows = await prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take,
        include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            tenant: { select: { name: true, slug: true } }
        }
    });

    const query = String(q || "").trim().toLowerCase();
    return rows
        .map((row) => ({
            id: row.id,
            action: row.action,
            entity: row.entity,
            entityId: row.entityId,
            tenantName: row.tenant?.name || null,
            tenantSlug: row.tenant?.slug || null,
            actorName:
                [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" ") || null,
            actorEmail: row.user?.email || null,
            metadata: row.metadata || {},
            createdAt: row.createdAt
        }))
        .filter((row) => {
            if (!query) return true;
            return [row.action, row.entity, row.tenantName, row.actorEmail, row.actorName]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query);
        });
}

export function auditToCsv(rows = []) {
    return toCsv(
        [
            { label: "Timestamp", value: (row) => new Date(row.createdAt).toISOString() },
            { label: "Action", value: (row) => row.action },
            { label: "Entity", value: (row) => row.entity },
            { label: "Entity ID", value: (row) => row.entityId },
            { label: "Tenant", value: (row) => row.tenantName },
            { label: "Actor", value: (row) => row.actorName },
            { label: "Actor Email", value: (row) => row.actorEmail }
        ],
        rows
    );
}
