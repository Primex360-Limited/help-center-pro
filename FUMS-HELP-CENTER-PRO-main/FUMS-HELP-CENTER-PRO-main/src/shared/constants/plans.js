/**
 * Canonical workspace plan catalog used by the provider admin portal.
 *
 * HelpCentre Pro charges in Naira only (Paystack), so `priceNgn` — not the
 * legacy `mrr` USD hint — is the source of truth for dashboard revenue
 * figures. The provider admin can override any field at runtime; overrides are
 * persisted in `PlatformSetting("admin.plans")` and merged over these defaults
 * by `modules/platform/plan-catalog.service.js`.
 *
 * `mrr` is kept on every entry because older call sites (signup, workspace
 * provisioning) still persist it as a USD hint on `Tenant.settings`.
 */

import { usdToNaira } from "../utils/currency.js";

const PLAN_DEFAULTS = [
    {
        key: "trial",
        label: "Trial",
        tagline: "Kick the tyres before you commit",
        mrr: 0,
        seatLimit: 5,
        extraSeatUsd: 0,
        ticketLimit: 200,
        popular: false,
        order: 0,
        features: [
            "Email & chat inbox",
            "Shared team queue",
            "Basic reports",
            "Community support"
        ]
    },
    {
        key: "starter",
        label: "Starter",
        tagline: "For small support teams finding their feet",
        mrr: 29,
        seatLimit: 5,
        extraSeatUsd: 12,
        ticketLimit: 500,
        popular: false,
        order: 1,
        features: [
            "Email & chat inbox",
            "5 saved replies",
            "Basic reports",
            "Email support"
        ]
    },
    {
        key: "growth",
        label: "Growth",
        tagline: "The sweet spot for scaling support desks",
        mrr: 79,
        seatLimit: 15,
        extraSeatUsd: 14,
        ticketLimit: 3000,
        popular: true,
        order: 2,
        features: [
            "Email, chat, call",
            "Unlimited templates",
            "SLA timers",
            "Customer roles",
            "Webhook events"
        ]
    },
    {
        key: "scale",
        label: "Scale",
        tagline: "Everything a busy contact centre needs",
        mrr: 199,
        seatLimit: 20,
        extraSeatUsd: 18,
        ticketLimit: 15000,
        popular: false,
        order: 3,
        features: [
            "Everything in growth",
            "Advanced analytics",
            "Audit log export",
            "API access",
            "Priority support"
        ]
    },
    {
        key: "enterprise",
        label: "Enterprise",
        tagline: "Custom governance for large organisations",
        mrr: 599,
        seatLimit: 50,
        extraSeatUsd: 22,
        ticketLimit: 100000,
        popular: false,
        order: 4,
        features: [
            "SSO / SAML",
            "Dedicated CSM",
            "Custom SLA",
            "Sandbox workspace",
            "On-prem connectors"
        ]
    }
];

function toCatalogEntry(entry) {
    return Object.freeze({
        ...entry,
        features: Object.freeze([...entry.features]),
        priceNgn: usdToNaira(entry.mrr),
        extraSeatNgn: usdToNaira(entry.extraSeatUsd)
    });
}

/** `TENANT_PLANS` stays keyed for legacy lookups (`resolvePlan(key)`). */
export const TENANT_PLANS = Object.freeze(
    PLAN_DEFAULTS.reduce((acc, entry) => {
        acc[entry.key] = toCatalogEntry(entry);
        return acc;
    }, {})
);

export function resolvePlan(planKey) {
    const key = String(planKey || "growth")
        .trim()
        .toLowerCase();
    return TENANT_PLANS[key] || TENANT_PLANS.growth;
}

export function listPlans() {
    return Object.values(TENANT_PLANS);
}

/** Billable plans only (excludes the free trial tier). */
export function listPaidPlans() {
    return listPlans().filter((plan) => plan.priceNgn > 0);
}

/** Fresh, mutable copy of the default catalog for the admin editor. */
export function defaultPlanCatalog() {
    return listPlans()
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((plan) => ({
            key: plan.key,
            label: plan.label,
            tagline: plan.tagline,
            mrr: plan.mrr,
            priceNgn: plan.priceNgn,
            seatLimit: plan.seatLimit,
            extraSeatNgn: plan.extraSeatNgn,
            ticketLimit: plan.ticketLimit,
            popular: plan.popular,
            order: plan.order,
            features: [...plan.features]
        }));
}

