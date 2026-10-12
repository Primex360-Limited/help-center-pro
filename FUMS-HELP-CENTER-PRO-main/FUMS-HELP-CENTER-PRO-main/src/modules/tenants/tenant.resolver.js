import { env } from "../../config/env.js";
import { REQUEST_SCOPE } from "../../shared/constants/system.js";

/**
 * Host-based tenant resolution (PRD §Multi-tenancy).
 *
 *   acme.helpcentrepro.com   -> tenant "acme"
 *   admin.helpcentrepro.com  -> provider super-admin portal
 *   acme.localhost:5173      -> tenant "acme" (local development)
 *   helpcentrepro.com        -> no tenant
 *
 * The `x-tenant-slug` header is honoured as an explicit override so API
 * clients, the marketing site and integration tests do not need real
 * subdomains.
 */

/** Subdomains that can never be a tenant slug. */
export const RESERVED_SUBDOMAINS = Object.freeze([
    "www",
    "api",
    "app",
    "static",
    "assets",
    "cdn",
    "mail",
    "status",
    "docs"
]);

const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Strip port, trailing dot and case from a Host header. */
export function normalizeHost(host) {
    if (!host || typeof host !== "string") {
        return "";
    }

    return host.split(",")[0].split(":")[0].replace(/\.$/, "").trim().toLowerCase();
}

/** Read the explicit `x-tenant-slug` style override header, if present. */
export function readSlugHeader(req, headerName = env.TENANT_HEADER) {
    const raw = req?.headers?.[headerName];

    if (Array.isArray(raw)) {
        return raw.length ? String(raw[0]).trim().toLowerCase() : null;
    }

    return raw ? String(raw).trim().toLowerCase() : null;
}

/**
 * Extract the tenant slug from the request host.
 * Returns `null` for the apex domain, bare localhost and IP addresses.
 */
export function getSubdomain(host) {
    const normalized = normalizeHost(host);

    if (!normalized || IPV4_PATTERN.test(normalized) || normalized.includes(":")) {
        return null;
    }

    // Local development: `<slug>.localhost`
    if (normalized === "localhost") {
        return null;
    }

    if (normalized.endsWith(".localhost")) {
        const slug = normalized.slice(0, -".localhost".length);
        return slug && !slug.includes(".") ? slug : null;
    }

    const root = normalizeHost(env.ROOT_DOMAIN);
    const providerSubdomain = String(env.PROVIDER_SUBDOMAIN || "").toLowerCase();

    if (normalized === root || normalized === `www.${root}`) {
        return null;
    }

    if (!root || !normalized.endsWith(`.${root}`)) {
        // Unrecognised host (custom domain / preview URL): fall back to headers.
        return null;
    }

    const slug = normalized.slice(0, -(root.length + 1));

    if (!slug || slug.includes(".")) {
        return null;
    }

    if (slug === providerSubdomain) {
        return providerSubdomain;
    }

    return RESERVED_SUBDOMAINS.includes(slug) ? null : slug;
}

/**
 * Resolve the tenant slug for a request.
 * Header wins over subdomain so dev/API callers stay in control.
 */
export function resolveTenantSlug(req) {
    const headerSlug = readSlugHeader(req);

    if (headerSlug) {
        return headerSlug;
    }

    return getSubdomain(req?.headers?.host);
}

/**
 * Determine whether this request targets the provider super-admin portal.
 * A tenant-scoped JWT (`tenant_id` present) always wins, so a provider user
 * cannot be mistaken for a tenant user merely because of the header.
 */
export function isProviderRequest(req, slug = resolveTenantSlug(req)) {
    if (req?.user?.tenant_id) {
        return false;
    }

    return slug === String(env.PROVIDER_SUBDOMAIN || "").toLowerCase();
}

/**
 * Build the tenant context object attached to every request.
 * Pure — no database access, so it can be unit tested directly.
 */
export function buildTenantContext(req) {
    const slug = resolveTenantSlug(req);
    const scope = isProviderRequest(req, slug) ? REQUEST_SCOPE.PROVIDER : REQUEST_SCOPE.TENANT;

    return {
        scope,
        slug: scope === REQUEST_SCOPE.PROVIDER ? String(env.PROVIDER_SUBDOMAIN) : slug,
        source: readSlugHeader(req) ? "header" : getSubdomain(req?.headers?.host) ? "subdomain" : null,
        tenant: null
    };
}
