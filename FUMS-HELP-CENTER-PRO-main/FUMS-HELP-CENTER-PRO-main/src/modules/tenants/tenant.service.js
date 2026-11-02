import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { env } from "../../config/env.js";
import {
    AUDIT_ACTION,
    INVITATION_STATUS,
    TENANT_STATUS,
    USER_STATUS,
    USER_TYPE
} from "../../shared/constants/system.js";
import { TENANT_ROLE } from "../../shared/constants/roles.js";
import { resolvePlan } from "../../shared/constants/plans.js";
import { toNaira } from "../../shared/utils/currency.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import { getPlanCatalogMap, priceNgnFromMap } from "../platform/plan-catalog.service.js";
import { syncBillingLedger, summarizeInvoices } from "../platform/billing-ledger.service.js";
import { getLiveAnnouncement } from "../platform/platform-content.service.js";
import {
    generateRandomToken,
    generateTemporaryPassword,
    hashPassword,
    hashToken
} from "../auth/auth.utils.js";
import { sendTenantInvitationEmail } from "../auth/auth.email.js";
import { safeSendEmail, revokeTenantSessions } from "../auth/auth.service.js";
import { provisionTenantRoles } from "../roles/seedSystemRoles.js";

const FORTY_EIGHT_HOURS_IN_MS = 48 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function asSettings(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
}

async function ticketCountsByUserIds(userIds, since) {
    if (!userIds.length) return new Map();

    const rows = await prisma.ticket.groupBy({
        by: ["createdByUserId"],
        where: {
            createdByUserId: { in: userIds },
            createdAt: { gte: since }
        },
        _count: { _all: true }
    });

    const map = new Map();
    for (const row of rows) {
        map.set(row.createdByUserId, row._count?._all || 0);
    }
    return map;
}

async function lastActivityByUserIds(userIds) {
    if (!userIds.length) return new Map();

    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, lastLoginAt: true, lastSeenAt: true, updatedAt: true }
    });

    const map = new Map();
    for (const user of users) {
        const dates = [user.lastSeenAt, user.lastLoginAt, user.updatedAt].filter(Boolean);
        map.set(
            user.id,
            dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null
        );
    }
    return map;
}

function pickPrimaryAdmin(users = []) {
    const admins = users.filter((user) => user.role?.name === TENANT_ROLE.ADMIN);
    const preferred =
        admins.find((user) => user.status === USER_STATUS.ACTIVE) ||
        admins[0] ||
        users.find((user) => user.status === USER_STATUS.ACTIVE) ||
        users[0] ||
        null;
    return preferred;
}

function buildTenantView(tenant, extras = {}) {
    const settings = asSettings(tenant.settings);
    const plan = resolvePlan(tenant.plan || settings.plan);
    const catalogPlan = extras.catalog?.get?.(plan.key);
    const seatsUsed = extras.seatsUsed ?? 0;
    const seatLimit = tenant.seatLimit ?? catalogPlan?.seatLimit ?? plan.seatLimit;
    // Naira MRR: an explicit per-tenant override wins, otherwise the workspace
    // follows the (admin editable) plan catalog price.
    const customMrrNgn = Number(settings.mrrNgn);
    const mrr =
        Number.isFinite(customMrrNgn) && customMrrNgn > 0
            ? toNaira(customMrrNgn)
            : priceNgnFromMap(extras.catalog, plan.key, plan.priceNgn ?? toNaira(plan.mrr));
    const isTrial = plan.key === "trial" || Boolean(settings.trial);
    const admin = extras.admin || null;

    return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        primaryDomain: tenant.primaryDomain,
        status: tenant.status,
        plan: plan.key,
        planLabel: plan.label,
        seatLimit,
        seatsUsed,
        seatsLabel: `${seatsUsed}/${seatLimit}`,
        mrr,
        planPriceNgn: mrr,
        currency: "NGN",
        ticketsLast30d: extras.ticketsLast30d ?? 0,
        lastActiveAt: extras.lastActiveAt ?? null,
        country: settings.country || null,
        industry: settings.industry || null,
        trial: isTrial,
        suspendedAt: tenant.suspendedAt,
        suspendedReason: tenant.suspendedReason,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        admin: admin
            ? {
                  id: admin.id,
                  email: admin.email,
                  firstName: admin.firstName,
                  lastName: admin.lastName,
                  status: admin.status,
                  fullName: [admin.firstName, admin.lastName].filter(Boolean).join(" ")
              }
            : null,
        users: extras.users || undefined
    };
}

async function hydrateTenants(tenants, catalog = null) {
    if (!tenants.length) return [];

    const tenantIds = tenants.map((tenant) => tenant.id);
    const users = await prisma.user.findMany({
        where: { tenantId: { in: tenantIds } },
        include: { role: true },
        orderBy: { createdAt: "asc" }
    });

    const usersByTenant = new Map();
    for (const user of users) {
        const list = usersByTenant.get(user.tenantId) || [];
        list.push(user);
        usersByTenant.set(user.tenantId, list);
    }

    const allUserIds = users.map((user) => user.id);
    const since = new Date(Date.now() - THIRTY_DAYS_MS);
    const [ticketMap, activityMap] = await Promise.all([
        ticketCountsByUserIds(allUserIds, since),
        lastActivityByUserIds(allUserIds)
    ]);

    return tenants.map((tenant) => {
        const tenantUsers = usersByTenant.get(tenant.id) || [];
        const seatsUsed = tenantUsers.filter((user) =>
            [USER_STATUS.ACTIVE, USER_STATUS.INVITED].includes(user.status)
        ).length;
        const ticketsLast30d = tenantUsers.reduce(
            (sum, user) => sum + (ticketMap.get(user.id) || 0),
            0
        );
        const activityDates = tenantUsers
            .map((user) => activityMap.get(user.id))
            .filter(Boolean);
        const lastActiveAt = activityDates.length
            ? new Date(Math.max(...activityDates.map((d) => d.getTime())))
            : tenant.updatedAt;

        return buildTenantView(tenant, {
            catalog,
            seatsUsed,
            ticketsLast30d,
            lastActiveAt,
            admin: pickPrimaryAdmin(tenantUsers),
            users: tenantUsers.map((user) => ({
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                status: user.status,
                role: user.role?.name || null,
                lastLoginAt: user.lastLoginAt,
                lastSeenAt: user.lastSeenAt
            }))
        });
    });
}

export async function listTenants({ q = "", status = "all", plan = "all" } = {}) {
    const [tenants, catalog] = await Promise.all([
        prisma.tenant.findMany({
            orderBy: { createdAt: "desc" }
        }),
        getPlanCatalogMap()
    ]);

    let views = await hydrateTenants(tenants, catalog);
    const query = String(q || "").trim().toLowerCase();

    if (query) {
        views = views.filter((tenant) => {
            const haystack = [
                tenant.name,
                tenant.slug,
                tenant.primaryDomain,
                tenant.id,
                tenant.admin?.email,
                tenant.admin?.fullName,
                tenant.country
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return haystack.includes(query);
        });
    }

    if (status && status !== "all") {
        if (status === "trial") {
            views = views.filter((tenant) => tenant.trial);
        } else {
            views = views.filter((tenant) => tenant.status === status);
        }
    }

    if (plan && plan !== "all") {
        views = views.filter((tenant) => tenant.plan === plan);
    }

    return views;
}

export async function getTenantById(tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new AppError("Tenant not found", 404);
    const catalog = await getPlanCatalogMap();
    const [view] = await hydrateTenants([tenant], catalog);
    return view;
}

const TREND_WEEKS = 12;

/** MRR carried by each week, based on when each paid workspace went live. */
function buildMrrTrend(tenants, currentMrr) {
    const now = new Date();
    const paidTenants = tenants.filter(
        (tenant) => !tenant.trial && tenant.mrr > 0 && tenant.status === TENANT_STATUS.ACTIVE
    );

    const weeks = Array.from({ length: TREND_WEEKS }, (_, index) => {
        const weekEnd = new Date(now);
        weekEnd.setHours(23, 59, 59, 999);
        weekEnd.setDate(weekEnd.getDate() - (TREND_WEEKS - 1 - index) * 7);

        const mrrAtWeek = paidTenants.reduce((sum, tenant) => {
            const startedAt = tenant.createdAt ? new Date(tenant.createdAt) : weekEnd;
            return startedAt <= weekEnd ? sum + tenant.mrr : sum;
        }, 0);

        return {
            weekStart: weekEnd.toISOString(),
            label: `W${index + 1}`,
            mrr: mrrAtWeek
        };
    });

    const first = weeks[0]?.mrr || 0;
    const changePercent =
        first > 0 ? ((currentMrr - first) / first) * 100 : currentMrr > 0 ? 100 : 0;

    return {
        currentMrr,
        changePercent: Math.round(changePercent * 10) / 10,
        weeks
    };
}

export async function getPlatformOverview() {
    const tenants = await listTenants();
    const active = tenants.filter((tenant) => tenant.status === TENANT_STATUS.ACTIVE);
    const onTrial = active.filter((tenant) => tenant.trial);
    const mrr = active.reduce((sum, tenant) => sum + (tenant.trial ? 0 : tenant.mrr), 0);
    const seatsInUse = tenants.reduce((sum, tenant) => sum + tenant.seatsUsed, 0);
    const ticketsLast30d = tenants.reduce((sum, tenant) => sum + tenant.ticketsLast30d, 0);

    // Past-due figures come from the same ledger the Billing screen uses.
    let pastDueInvoices = 0;
    let pastDueAmount = 0;
    try {
        const ledger = await syncBillingLedger(tenants);
        const summary = summarizeInvoices(ledger.invoices);
        pastDueInvoices = summary.pastDueCount;
        pastDueAmount = summary.pastDueAmount;
    } catch {
        // Never break the overview if the ledger is unavailable.
    }

    const newest = tenants.slice(0, 5);
    // Prefer operator-meaningful events; sign-in noise is only a fallback.
    let recentActivity = await prisma.auditLog.findMany({
        where: { action: { notIn: ["LOGIN_SUCCESS"] } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            tenant: { select: { name: true, slug: true } }
        }
    });
    if (!recentActivity.length) {
        recentActivity = await prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            include: {
                user: { select: { firstName: true, lastName: true, email: true } },
                tenant: { select: { name: true, slug: true } }
            }
        });
    }

    return {
        metrics: {
            activeTenants: active.length,
            trialTenants: onTrial.length,
            totalTenants: tenants.length,
            mrr,
            arr: mrr * 12,
            seatsInUse,
            ticketsLast30d,
            pastDueInvoices,
            pastDueAmount,
            currency: "NGN"
        },
        mrrTrend: buildMrrTrend(tenants, mrr),
        newestWorkspaces: newest,
        recentActivity: recentActivity.map((row) => ({
            id: row.id,
            action: row.action,
            entity: row.entity,
            entityId: row.entityId,
            tenantId: row.tenantId,
            tenantName: row.tenant?.name || null,
            actorName: [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" "),
            actorEmail: row.user?.email || null,
            createdAt: row.createdAt,
            metadata: row.metadata
        })),
        liveAnnouncement: await getLiveAnnouncement()
    };
}

export async function inviteTenantWorkspace(payload, invitedBy) {
    const plan = resolvePlan(payload.plan);
    const temporaryPassword =
        payload.password?.trim() || generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const existingSlug = await prisma.tenant.findFirst({
        where: {
            OR: [
                { slug: payload.slug },
                ...(payload.primaryDomain ? [{ primaryDomain: payload.primaryDomain }] : [])
            ]
        },
        select: { id: true }
    });
    if (existingSlug) {
        throw new AppError("A workspace with this domain or slug already exists", 409);
    }

    const existingUser = await prisma.user.findFirst({
        where: { email: payload.email, tenantId: { not: null } },
        select: { id: true, tenantId: true }
    });
    if (existingUser) {
        throw new AppError("A tenant user with this email already exists", 409);
    }

    const tenant = await prisma.tenant.create({
        data: {
            name: payload.workspaceName,
            slug: payload.slug,
            primaryDomain: payload.primaryDomain,
            status: TENANT_STATUS.PROVISIONING,
            plan: plan.key,
            seatLimit: plan.seatLimit,
            settings: {
                country: payload.country,
                trial: plan.key === "trial",
                mrr: plan.mrr,
                invitedAdminEmail: payload.email,
                website: payload.website || null,
                industry: payload.industry || null,
                timezone: payload.timezone || null,
                language: payload.language || null,
                companySize: payload.companySize || null
            }
        }
    });

    const roles = await provisionTenantRoles(tenant.id);
    const adminRole = roles[TENANT_ROLE.ADMIN];
    if (!adminRole) {
        throw new AppError("Failed to provision Tenant Admin role", 500);
    }

    const user = await prisma.user.create({
        data: {
            tenantId: tenant.id,
            userType: USER_TYPE.TENANT,
            email: payload.email,
            passwordHash,
            firstName: payload.firstName,
            lastName: payload.lastName,
            roleId: adminRole.id,
            status: USER_STATUS.INVITED,
            emailVerified: false,
            mustChangePassword: true,
            invitedById: invitedBy,
            deniedPermissions: [],
            timezone: payload.timezone,
            industry: payload.industry,
            language: payload.language,
            companySize: payload.companySize,
            profileCompleted: Boolean(payload.timezone && payload.industry && payload.language && payload.companySize)
        }
    });

    const rawToken = generateRandomToken();
    const invitation = await prisma.agentInvitation.create({
        data: {
            tenantId: tenant.id,
            userId: user.id,
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            roleId: adminRole.id,
            invitedById: invitedBy,
            tokenHash: hashToken(rawToken),
            status: INVITATION_STATUS.PENDING,
            expiresAt: new Date(Date.now() + FORTY_EIGHT_HOURS_IN_MS)
        }
    });

    const emailSent = await safeSendEmail(
        () =>
            sendTenantInvitationEmail({
                to: payload.email,
                firstName: payload.firstName,
                token: rawToken,
                workspaceName: tenant.name,
                temporaryPassword
            }),
        `tenant invitation email to ${payload.email}`
    );

    await recordAuditLog({
        tenantId: tenant.id,
        userId: invitedBy,
        action: AUDIT_ACTION.TENANT_PROVISIONED,
        entity: "Tenant",
        entityId: tenant.id,
        metadata: { plan: plan.key, adminEmail: payload.email }
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: invitedBy,
        action: AUDIT_ACTION.TENANT_ADMIN_INVITED,
        entity: "Invitation",
        entityId: invitation.id,
        metadata: { email: payload.email, emailSent }
    });

    const view = await getTenantById(tenant.id);

    return {
        tenant: view,
        invitation: {
            id: invitation.id,
            email: invitation.email,
            expiresAt: invitation.expiresAt,
            emailSent,
            ...(env.NODE_ENV !== "production"
                ? { inviteToken: rawToken, temporaryPassword }
                : {})
        }
    };
}

export async function suspendTenant(tenantId, { reason } = {}, actorId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new AppError("Tenant not found", 404);
    if (tenant.status === TENANT_STATUS.SUSPENDED) {
        return getTenantById(tenantId);
    }

    await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            status: TENANT_STATUS.SUSPENDED,
            suspendedAt: new Date(),
            suspendedReason: reason || "Suspended by platform administrator"
        }
    });

    await revokeTenantSessions(tenantId);
    await recordAuditLog({
        tenantId,
        userId: actorId,
        action: AUDIT_ACTION.TENANT_SUSPENDED,
        entity: "Tenant",
        entityId: tenantId,
        metadata: { reason: reason || null }
    });

    return getTenantById(tenantId);
}

export async function activateTenant(tenantId, actorId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new AppError("Tenant not found", 404);

    await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            status: TENANT_STATUS.ACTIVE,
            suspendedAt: null,
            suspendedReason: null
        }
    });

    await recordAuditLog({
        tenantId,
        userId: actorId,
        action: AUDIT_ACTION.TENANT_REACTIVATED,
        entity: "Tenant",
        entityId: tenantId,
        metadata: {}
    });

    return getTenantById(tenantId);
}

export async function deleteTenant(tenantId, actorId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new AppError("Tenant not found", 404);

    await revokeTenantSessions(tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });

    await recordAuditLog({
        tenantId: null,
        userId: actorId,
        action: AUDIT_ACTION.TENANT_UPDATED,
        entity: "Tenant",
        entityId: tenantId,
        metadata: { deleted: true, name: tenant.name, slug: tenant.slug }
    });

    return { id: tenantId, deleted: true };
}

export async function updateTenant(tenantId, payload, actorId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new AppError("Tenant not found", 404);

    const { name, primaryDomain, plan, seatLimit, country } = payload;

    // Check if primaryDomain is being changed and if it conflicts with another tenant
    if (primaryDomain && primaryDomain !== tenant.primaryDomain) {
        const existingDomain = await prisma.tenant.findFirst({
            where: { primaryDomain, id: { not: tenantId } },
            select: { id: true }
        });
        if (existingDomain) {
            throw new AppError("A workspace with this domain already exists", 409);
        }
    }

    const planInfo = plan ? resolvePlan(plan) : null;

    const nextSettings = { ...asSettings(tenant.settings) };
    if (planInfo) {
        // MRR follows the editable plan catalog — drop any stale per-tenant
        // Naira override so the new plan price applies immediately.
        delete nextSettings.mrrNgn;
    }

    const updatedSettings = {
        ...nextSettings,
        ...(country !== undefined && { country }),
        ...(planInfo && { planKey: planInfo.key })
    };

    const nextSeatLimit =
        seatLimit !== undefined
            ? seatLimit
            : planInfo
              ? planInfo.seatLimit
              : undefined;

    const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            ...(name !== undefined && { name }),
            ...(primaryDomain !== undefined && { primaryDomain }),
            ...(plan !== undefined && { plan }),
            ...(nextSeatLimit !== undefined && { seatLimit: nextSeatLimit }),
            settings: updatedSettings
        }
    });

    await recordAuditLog({
        tenantId,
        userId: actorId,
        action: AUDIT_ACTION.TENANT_UPDATED,
        entity: "Tenant",
        entityId: tenantId,
        metadata: {
            changes: {
                ...(name !== undefined && { name }),
                ...(primaryDomain !== undefined && { primaryDomain }),
                ...(plan !== undefined && { plan }),
                ...(seatLimit !== undefined && { seatLimit }),
                ...(country !== undefined && { country })
            }
        }
    });
    return getTenantById(tenantId);
}

export function tenantsToCsv(tenants) {
    const headers = [
        "Workspace",
        "Slug",
        "Domain",
        "Admin Email",
        "Country",
        "Plan",
        "Status",
        "Seats Used",
        "Seat Limit",
        "MRR",
        "Tickets 30d",
        "Last Active",
        "Created At"
    ];

    const escape = (value) => {
        const text = value == null ? "" : String(value);
        if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
        return text;
    };

    const rows = tenants.map((tenant) =>
        [
            tenant.name,
            tenant.slug,
            tenant.primaryDomain,
            tenant.admin?.email || "",
            tenant.country || "",
            tenant.planLabel,
            tenant.status,
            tenant.seatsUsed,
            tenant.seatLimit,
            tenant.mrr,
            tenant.ticketsLast30d,
            tenant.lastActiveAt ? new Date(tenant.lastActiveAt).toISOString() : "",
            tenant.createdAt ? new Date(tenant.createdAt).toISOString() : ""
        ]
            .map(escape)
            .join(",")
    );

    return [headers.join(","), ...rows].join("\n");
}
