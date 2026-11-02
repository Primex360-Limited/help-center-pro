import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { defaultPlanCatalog, listPlans } from "../../shared/constants/plans.js";
import { toNaira } from "../../shared/utils/currency.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";
import { AUDIT_ACTION } from "../../shared/constants/system.js";

/**
 * Editable plan catalog.
 *
 * Defaults live in `shared/constants/plans.js`; provider admins can override
 * price, seats, ticket limits, features and the "most popular" badge from the
 * Plans & Pricing screen. Overrides are stored as JSON in
 * `PlatformSetting("admin.plans")` so no migration is needed, and every
 * tenant MRR figure is derived from this catalog — an edit takes effect
 * immediately everywhere (overview, tenants, billing, analytics).
 */

export const PLAN_SETTING_KEY = "admin.plans";

function asNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function asText(value, fallback = "") {
    return String(value ?? fallback).trim();
}

function normalizeFeatures(value, fallback) {
    const source = Array.isArray(value) ? value : fallback || [];
    return source
        .map((feature) => asText(feature))
        .filter(Boolean)
        .slice(0, 12);
}

function normalizeEntry(raw = {}, fallback = {}) {
    return {
        key: fallback.key,
        label: asText(raw.label, fallback.label) || fallback.label,
        tagline: asText(raw.tagline, fallback.tagline),
        priceNgn: Math.max(0, toNaira(asNumber(raw.priceNgn, fallback.priceNgn))),
        seatLimit: Math.max(1, Math.round(asNumber(raw.seatLimit, fallback.seatLimit))),
        extraSeatNgn: Math.max(
            0,
            toNaira(asNumber(raw.extraSeatNgn, fallback.extraSeatNgn))
        ),
        ticketLimit: Math.max(
            0,
            Math.round(asNumber(raw.ticketLimit, fallback.ticketLimit))
        ),
        popular: Boolean(raw.popular ?? fallback.popular),
        order: asNumber(raw.order, fallback.order),
        features: normalizeFeatures(raw.features, fallback.features)
    };
}

function mergeWithDefaults(stored) {
    const storedByKey = new Map();
    if (Array.isArray(stored)) {
        for (const entry of stored) {
            if (entry && typeof entry === "object" && entry.key) {
                storedByKey.set(String(entry.key), entry);
            }
        }
    }

    return defaultPlanCatalog()
        .map((base) => normalizeEntry(storedByKey.get(base.key) || {}, base))
        .sort((a, b) => a.order - b.order);
}

async function readStoredCatalog() {
    try {
        const row = await prisma.platformSetting.findUnique({
            where: { key: PLAN_SETTING_KEY }
        });
        const value = row?.value;
        if (Array.isArray(value)) return value;
        if (value && Array.isArray(value.plans)) return value.plans;
        return null;
    } catch {
        // Table missing before migrate — fall back to defaults, never 500.
        return null;
    }
}

/** Full catalog, defaults merged with any admin overrides. */
export async function getPlanCatalog() {
    return mergeWithDefaults(await readStoredCatalog());
}

/** `Map<planKey, plan>` for cheap lookups while hydrating tenants. */
export async function getPlanCatalogMap() {
    const catalog = await getPlanCatalog();
    return new Map(catalog.map((plan) => [plan.key, plan]));
}

/** Naira price for a plan key — the tenant MRR source of truth. */
export async function getPlanPriceNgn(planKey) {
    const map = await getPlanCatalogMap();
    if (map.has(planKey)) return map.get(planKey).priceNgn;
    return listPlans().find((plan) => plan.key === planKey)?.priceNgn || 0;
}

/** Naira price for a plan key from an already-hydrated map. */
export function priceNgnFromMap(map, planKey, fallback = 0) {
    if (map?.has?.(planKey)) return map.get(planKey).priceNgn;
    return fallback;
}

async function persistCatalog(catalog, actorId) {
    try {
        await prisma.platformSetting.upsert({
            where: { key: PLAN_SETTING_KEY },
            create: {
                key: PLAN_SETTING_KEY,
                value: { plans: catalog, currency: "NGN" },
                updatedBy: actorId || null
            },
            update: {
                value: { plans: catalog, currency: "NGN" },
                updatedBy: actorId || null
            }
        });
    } catch (error) {
        throw new AppError(
            error?.message ||
                "Unable to save the plan catalog. Run database migrations and try again.",
            503
        );
    }
}

/**
 * Update one plan (price, seats, limits, features, popular badge).
 * Returns the full catalog so the UI can re-render distribution instantly.
 */
export async function updatePlan(planKey, patch = {}, actorId = null) {
    const key = String(planKey || "").trim().toLowerCase();
    const catalog = await getPlanCatalog();
    const existing = catalog.find((plan) => plan.key === key);

    if (!existing) {
        throw new AppError(`Unknown plan "${planKey}"`, 404);
    }

    const next = normalizeEntry({ ...existing, ...patch }, existing);

    if (patch.popular === true) {
        // Exactly one "most popular" plan, like the marketing site.
        for (const plan of catalog) {
            if (plan.key !== key) plan.popular = false;
        }
    }

    const nextCatalog = catalog
        .map((plan) => (plan.key === key ? next : plan))
        .sort((a, b) => a.order - b.order);

    await persistCatalog(nextCatalog, actorId);

    await recordAuditLog({
        userId: actorId,
        action: AUDIT_ACTION.PLAN_UPDATED,
        entity: "Plan",
        entityId: key,
        metadata: {
            plan: key,
            priceNgn: next.priceNgn,
            seatLimit: next.seatLimit,
            seatLimitPrevious: existing.seatLimit,
            pricePrevious: existing.priceNgn
        }
    });

    return { plan: next, plans: nextCatalog };
}
