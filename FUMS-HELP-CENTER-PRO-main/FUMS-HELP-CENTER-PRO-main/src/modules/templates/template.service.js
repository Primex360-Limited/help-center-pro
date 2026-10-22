import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";

/**
 * Message templates — reusable agent replies with {{variables}}.
 * The four defaults are provisioned once per workspace, then fully editable.
 */

export const TEMPLATE_VARIABLES = [
    { key: "{{customer_name}}", label: "Customer name" },
    { key: "{{customer_email}}", label: "Customer email" },
    { key: "{{ticket_id}}", label: "Ticket ID" }
];

const DEFAULT_TEMPLATES = [
    {
        name: "Issue Resolved",
        category: "Resolution",
        content:
            "Hi {{customer_name}}, Great news! We've resolved the issue you reported. Please let us know if you experience any further problems. If everything looks good, we'll close this ticket in 48 hours. Thank you for your patience!"
    },
    {
        name: "Need more info",
        category: "Follow-up",
        content:
            "Hi {{customer_name}}, Thank you for your patience. To help us resolve this faster, could you please provide the following: 1. Steps to reproduce the issue 2. Screenshots or error"
    },
    {
        name: "Escalation Notice",
        category: "Follow-up",
        content:
            "Hi {{customer_name}}, Great news! We've resolved the issue you reported. Please let us know if you experience any further problems. If everything looks good, we'll close this ticket in 48 hours. Thank you for your patience!"
    },
    {
        name: "Welcome Reply",
        category: "Greeting",
        content:
            "Hi {{customer_name}},\n\nThank you for reaching out to our support team! We've received your request and a member of our team will be assisting you shortly.\n\nYour ticket ID is {{ticket_id}} — you can use this for reference.\n\nBest regards,"
    }
];

async function ensureDefaultTemplates(tenantId) {
    const count = await prisma.messageTemplate.count({
        where: { tenantId: tenantId || null }
    });
    if (count > 0) return;

    await prisma.messageTemplate.createMany({
        data: DEFAULT_TEMPLATES.map((t) => ({ ...t, tenantId: tenantId || null }))
    });
}

export async function listTemplates(tenantId) {
    await ensureDefaultTemplates(tenantId);
    const templates = await prisma.messageTemplate.findMany({
        where: { tenantId: tenantId || null },
        orderBy: { createdAt: "asc" }
    });
    return { templates, variables: TEMPLATE_VARIABLES };
}

export async function createTemplate(tenantId, actorId, { name, category, content, isActive }) {
    const template = await prisma.messageTemplate.create({
        data: {
            tenantId: tenantId || null,
            name: name.trim(),
            category: (category || "General").trim(),
            content,
            isActive: isActive !== false,
            createdByUserId: actorId || null
        }
    });
    return { template };
}

async function findTemplateOrFail(tenantId, templateId) {
    const template = await prisma.messageTemplate.findFirst({
        where: { id: templateId, tenantId: tenantId || null }
    });
    if (!template) throw new AppError("Template not found", 404);
    return template;
}

export async function updateTemplate(tenantId, templateId, payload) {
    await findTemplateOrFail(tenantId, templateId);
    const data = {};
    if (payload.name !== undefined) data.name = payload.name.trim();
    if (payload.category !== undefined) data.category = payload.category.trim();
    if (payload.content !== undefined) data.content = payload.content;
    if (payload.isActive !== undefined) data.isActive = Boolean(payload.isActive);

    const template = await prisma.messageTemplate.update({
        where: { id: templateId },
        data
    });
    return { template };
}

export async function deleteTemplate(tenantId, templateId) {
    await findTemplateOrFail(tenantId, templateId);
    await prisma.messageTemplate.delete({ where: { id: templateId } });
    return { deleted: true };
}

export default { listTemplates, createTemplate, updateTemplate, deleteTemplate };
