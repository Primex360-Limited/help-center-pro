/**
 * Canonical workspace plan catalog used by the provider admin portal.
 * MRR values are the source of truth for dashboard revenue figures until a
 * full billing ledger exists.
 */

export const TENANT_PLANS = Object.freeze({
    trial: { key: "trial", label: "Trial", mrr: 0, seatLimit: 5 },
    starter: { key: "starter", label: "Starter", mrr: 49, seatLimit: 5 },
    growth: { key: "growth", label: "Growth", mrr: 99, seatLimit: 15 },
    scale: { key: "scale", label: "Scale", mrr: 199, seatLimit: 20 },
    enterprise: { key: "enterprise", label: "Enterprise", mrr: 499, seatLimit: 50 }
});

export function resolvePlan(planKey) {
    const key = String(planKey || "growth")
        .trim()
        .toLowerCase();
    return TENANT_PLANS[key] || TENANT_PLANS.growth;
}

export function listPlans() {
    return Object.values(TENANT_PLANS);
}
