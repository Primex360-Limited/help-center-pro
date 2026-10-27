import crypto from "crypto";
import prisma from "../../database/prisma/client.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { AUDIT_ACTION } from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";

export const BILLING_SETTING_KEY = "billing.premiumPrice";
export const DEFAULT_PREMIUM_PRICE_USD = 49;
/** Demo NGN conversion rate used when charging via Paystack (kobo). */
export const NGN_PER_USD = 1500;

const PREMIUM_FEATURES = Object.freeze([
    "Unlimited agents (within seat limit)",
    "Live chat widget with test + live API keys",
    "Outbound webhooks",
    "Priority email support"
]);

const FREE_FEATURES = Object.freeze([
    "Core ticketing",
    "Email + chat channels",
    "Basic automations"
]);

function asSettings(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
}

async function findWorkspaceOrFail(tenantId) {
    if (!tenantId) {
        throw new AppError("A workspace is required for billing", 400);
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        throw new AppError("Workspace not found", 404);
    }
    return tenant;
}

export async function getPremiumPriceUsd() {
    try {
        const row = await prisma.platformSetting.findUnique({
            where: { key: BILLING_SETTING_KEY }
        });
        const value = row?.value;
        if (typeof value === "number" && value > 0) return value;
        if (value && typeof value === "object" && Number(value.premiumPriceMonthlyUsd) > 0) {
            return Number(value.premiumPriceMonthlyUsd);
        }
    } catch {
        /* PlatformSetting may be unavailable before migrate */
    }
    return Number(env.PREMIUM_PRICE_MONTHLY_USD) || DEFAULT_PREMIUM_PRICE_USD;
}

function resolvePlan(tenant) {
    const settings = asSettings(tenant.settings);
    const fromBilling = settings.billing?.plan;
    const fromColumn = tenant.plan;
    const plan = String(fromBilling || fromColumn || "free").toLowerCase();
    return plan === "premium" ? "premium" : "free";
}

export async function getBilling({ tenantId }) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const settings = asSettings(tenant.settings);
    const plan = resolvePlan(tenant);
    const premiumPriceMonthlyUsd = await getPremiumPriceUsd();

    return {
        billing: {
            plan,
            premiumPriceMonthlyUsd,
            currency: "NGN",
            amountNgn: Math.round(premiumPriceMonthlyUsd * NGN_PER_USD),
            features: plan === "premium" ? PREMIUM_FEATURES : FREE_FEATURES,
            upgradedAt: settings.billing?.upgradedAt || null
        }
    };
}

function requirePaystackSecret() {
    if (!env.PAYSTACK_SECRET_KEY) {
        throw new AppError(
            "Paystack is not configured. Set PAYSTACK_SECRET_KEY in the environment.",
            503
        );
    }
    return env.PAYSTACK_SECRET_KEY;
}

export async function initializePaystackPayment({
    tenantId,
    email,
    actorId = null
}) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const secret = requirePaystackSecret();
    const toEmail = String(email || "").trim().toLowerCase();
    if (!toEmail || !toEmail.includes("@")) {
        throw new AppError("A valid email is required to start checkout", 400);
    }

    const premiumPriceMonthlyUsd = await getPremiumPriceUsd();
    const amountKobo = Math.round(premiumPriceMonthlyUsd * NGN_PER_USD * 100);
    const reference = `hcp_${tenant.id.slice(0, 8)}_${crypto.randomBytes(8).toString("hex")}`;

    const response = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${secret}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: toEmail,
                amount: amountKobo,
                currency: "NGN",
                reference,
                metadata: {
                    tenantId: tenant.id,
                    plan: "premium",
                    actorId: actorId || null
                },
                callback_url: `${env.FRONTEND_URL}/workspace/settings/billing?reference=${reference}`
            })
        }
    );

    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.status) {
        throw new AppError(
            json?.message || "Unable to initialize Paystack payment",
            502
        );
    }

    const settings = asSettings(tenant.settings);
    await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
            settings: {
                ...settings,
                billing: {
                    ...(settings.billing || {}),
                    lastPaystackReference: reference,
                    lastPaystackEmail: toEmail,
                    pendingAt: new Date().toISOString()
                }
            }
        }
    });

    return {
        authorization_url: json.data.authorization_url,
        access_code: json.data.access_code,
        reference: json.data.reference || reference
    };
}

export async function verifyPaystackPayment({
    tenantId,
    reference,
    actorId = null
}) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const secret = requirePaystackSecret();
    const ref = String(reference || "").trim();
    if (!ref) {
        throw new AppError("Payment reference is required", 400);
    }

    const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`,
        {
            method: "GET",
            headers: { Authorization: `Bearer ${secret}` }
        }
    );
    const json = await response.json().catch(() => ({}));

    if (!response.ok || !json?.status) {
        throw new AppError(
            json?.message || "Unable to verify Paystack payment",
            502
        );
    }

    const data = json.data || {};
    if (String(data.status).toLowerCase() !== "success") {
        throw new AppError(
            `Payment not successful (status: ${data.status || "unknown"})`,
            400
        );
    }

    const metaTenantId = data.metadata?.tenantId;
    if (metaTenantId && metaTenantId !== tenant.id) {
        throw new AppError("Payment reference does not belong to this workspace", 403);
    }

    const settings = asSettings(tenant.settings);
    const upgradedAt = new Date().toISOString();
    const updatedSettings = {
        ...settings,
        billing: {
            ...(settings.billing || {}),
            plan: "premium",
            upgradedAt,
            lastPaystackReference: ref,
            lastPaystackAmount: data.amount,
            lastPaystackCurrency: data.currency,
            pendingAt: null
        }
    };

    const updatedTenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
            plan: "premium",
            settings: updatedSettings
        }
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: actorId,
        action: AUDIT_ACTION.WORKSPACE_PROFILE_UPDATED,
        entity: "Tenant",
        entityId: tenant.id,
        metadata: { changes: { planUpgraded: true, reference: ref } }
    });

    return {
        billing: {
            plan: "premium",
            premiumPriceMonthlyUsd: await getPremiumPriceUsd(),
            upgradedAt,
            reference: ref
        },
        tenant: {
            id: updatedTenant.id,
            plan: updatedTenant.plan
        },
        message: "Workspace upgraded to premium"
    };
}

export default {
    getBilling,
    initializePaystackPayment,
    verifyPaystackPayment,
    getPremiumPriceUsd
};
