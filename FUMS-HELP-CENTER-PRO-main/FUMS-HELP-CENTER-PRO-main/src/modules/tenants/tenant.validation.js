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

const COMPANY_SIZES = [
    "1-10 employees",
    "11-50 employees",
    "51-200 employees",
    "201+ employees"
];

const LANGUAGE_CODES = [
    "en",
    "es",
    "fr",
    "de",
    "zh",
    "ja",
    "pt",
    "ru",
    "ar",
    "hi"
];

export const createTenantInviteSchema = z
    .object({
        workspaceName: z.string().min(2).max(120),
        primaryDomain: z.string().min(3).max(180).optional(),
        website: z.string().max(180).optional(),
        slug: z.string().min(2).max(48).optional(),
        plan: z.enum(planKeys).default("growth"),
        country: z.string().min(2).max(80).optional(),
        firstName: z.string().min(1).max(80),
        lastName: z.string().min(1).max(80),
        email: z.string().email(),
        password: z.string().min(8).max(128).optional(),
        timezone: z.string().min(2).max(80),
        industry: z.string().min(2).max(80),
        language: z.enum(LANGUAGE_CODES),
        companySize: z.enum(COMPANY_SIZES)
    })
    .transform((data) => {
        const domain =
            data.primaryDomain?.trim().toLowerCase() ||
            `${slugify(data.workspaceName) || "workspace"}.helpcentrepro.com`;
        const slug = data.slug?.trim().toLowerCase() || slugify(domain.split(".")[0] || data.workspaceName);
        const websiteRaw = String(data.website || "").trim();
        const website = websiteRaw
            ? /^https?:\/\//i.test(websiteRaw)
                ? websiteRaw
                : `https://${websiteRaw}`
            : null;

        return {
            ...data,
            email: data.email.toLowerCase().trim(),
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            workspaceName: data.workspaceName.trim(),
            primaryDomain: domain,
            website,
            slug: slug || `ws-${Date.now().toString(36)}`,
            country: data.country?.trim() || null,
            timezone: data.timezone.trim(),
            industry: data.industry.trim(),
            language: data.language,
            companySize: data.companySize
        };
    });

export const updateTenantStatusSchema = z.object({
    reason: z.string().max(500).optional()
});

export const updateTenantSchema = z
    .object({
        name: z.string().min(2).max(120).optional(),
        primaryDomain: z.string().min(3).max(180).optional(),
        plan: z.enum(planKeys).optional(),
        seatLimit: z.number().int().positive().optional(),
        country: z.string().min(2).max(80).optional()
    })
    .transform((data) => {
        const transformed = { ...data };
        if (data.primaryDomain !== undefined) {
            transformed.primaryDomain = data.primaryDomain.trim().toLowerCase() || null;
        }
        if (data.name !== undefined) {
            transformed.name = data.name.trim();
        }
        if (data.country !== undefined) {
            transformed.country = data.country.trim() || null;
        }
        return transformed;
    });
