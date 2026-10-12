import { z } from "zod";
import { UUID_PATTERN } from "../../shared/utils/uuid.js";
import { TENANT_PLANS } from "../../shared/constants/plans.js";

const uuidSchema = z.string().regex(UUID_PATTERN, "Invalid identifier");
const planKeys = Object.keys(TENANT_PLANS);

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}

export const listTenantsQuerySchema = z.object({
    q: z.string().optional().default(""),
    status: z
        .enum(["all", "active", "suspended", "provisioning", "trial"])
        .optional()
        .default("all"),
    plan: z.enum(["all", ...planKeys]).optional().default("all")
});

export const tenantIdParamSchema = z.object({
    id: uuidSchema
});

export const createTenantInviteSchema = z
    .object({
        workspaceName: z.string().min(2).max(120),
        primaryDomain: z.string().min(3).max(180).optional(),
        slug: z.string().min(2).max(48).optional(),
        plan: z.enum(planKeys).default("growth"),
        country: z.string().min(2).max(80).optional(),
        firstName: z.string().min(1).max(80),
        lastName: z.string().min(1).max(80),
        email: z.string().email(),
        password: z.string().min(8).max(128).optional()
    })
    .transform((data) => {
        const domain =
            data.primaryDomain?.trim().toLowerCase() ||
            `${slugify(data.workspaceName) || "workspace"}.helpcentrepro.com`;
        const slug = data.slug?.trim().toLowerCase() || slugify(domain.split(".")[0] || data.workspaceName);

        return {
            ...data,
            email: data.email.toLowerCase().trim(),
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            workspaceName: data.workspaceName.trim(),
            primaryDomain: domain,
            slug: slug || `ws-${Date.now().toString(36)}`,
            country: data.country?.trim() || null
        };
    });

export const updateTenantStatusSchema = z.object({
    reason: z.string().max(500).optional()
});
