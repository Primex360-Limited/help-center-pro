import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { AUDIT_ACTION } from "../../shared/constants/system.js";
import { recordAuditLog } from "../../shared/utils/auditLogger.js";

/**
 * Workspace (organisation) profile for tenant administrators.
 *
 * The `Tenant` row owns the display name; presentation-only fields such as the
 * logo and the workspace timezone live in the `Tenant.settings` JSON column so
 * no schema migration is needed to extend the profile later.
 */

function asSettings(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
}

function buildWorkspaceProfile(tenant) {
    const settings = asSettings(tenant.settings);

    return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        primaryDomain: tenant.primaryDomain || null,
        status: tenant.status,
        plan: tenant.plan || null,
        seatLimit: tenant.seatLimit ?? null,
        logoUrl: settings.logoUrl || null,
        timezone: settings.timezone || null,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
    };
}

async function findWorkspaceOrFail(tenantId) {
    if (!tenantId) {
        throw new AppError(
            "A workspace is required to manage organisation settings",
            400
        );
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

    if (!tenant) {
        throw new AppError("Workspace not found", 404);
    }

    return tenant;
}

export async function getWorkspaceProfile({ tenantId }) {
    const tenant = await findWorkspaceOrFail(tenantId);

    return { workspace: buildWorkspaceProfile(tenant) };
}

export async function updateWorkspaceProfile({
    tenantId,
    payload = {},
    actorId = null
}) {
    const tenant = await findWorkspaceOrFail(tenantId);
    const { name, logoUrl, timezone } = payload;

    const updatedSettings = {
        ...asSettings(tenant.settings),
        ...(logoUrl !== undefined && { logoUrl: logoUrl.trim() || null }),
        ...(timezone !== undefined && { timezone: timezone.trim() })
    };

    const updatedTenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
            ...(name !== undefined && { name: name.trim() }),
            settings: updatedSettings
        }
    });

    await recordAuditLog({
        tenantId: tenant.id,
        userId: actorId,
        action: AUDIT_ACTION.WORKSPACE_PROFILE_UPDATED,
        entity: "Tenant",
        entityId: tenant.id,
        metadata: {
            changes: {
                ...(name !== undefined && { name: name.trim() }),
                ...(timezone !== undefined && { timezone: timezone.trim() }),
                ...(logoUrl !== undefined && { logoUpdated: true })
            }
        }
    });

    return { workspace: buildWorkspaceProfile(updatedTenant) };
}

export default { getWorkspaceProfile, updateWorkspaceProfile };
