import prisma from "../../database/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";

/**
 * Workspace automation rules.
 *
 * A rule is a named, toggleable instruction the workspace applies to incoming
 * tickets (acknowledge, route, escalate, close). Rules are scoped to one
 * tenant and managed from Settings → Automations in the web app.
 */

export const AUTOMATION_RULE_TYPES = Object.freeze([
    "auto_acknowledge",
    "auto_assign",
    "round_robin",
    "priority_escalation",
    "auto_close",
    "sla_reminder"
]);

const DEFAULT_AUTOMATION_RULES = [
    {
        name: "Auto-Acknowledge",
        type: "auto_acknowledge",
        description:
            "Send an instant acknowledgement to every new ticket so customers know their request has landed with the team.",
        isActive: true
    },
    {
        name: "Round Robin Assignment",
        type: "round_robin",
        description:
            "Hand each new ticket to the next available agent so the workload stays balanced across the team.",
        isActive: true
    },
    {
        name: "Urgent Keyword Escalation",
        type: "priority_escalation",
        description:
            "Raise the priority to urgent whenever a ticket mentions outage, refund, downtime or data loss.",
        isActive: true
    },
    {
        name: "Quiet Hours Auto-Close",
        type: "auto_close",
        description:
            "Close tickets that have had no customer activity for 72 hours, with a polite closing note.",
        isActive: false
    }
];

const ASSIGNEE_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    profileImage: true
};

/** First read of a workspace seeds a small, editable starter set. */
async function ensureDefaultRules(tenantId) {
    const count = await prisma.automationRule.count({
        where: { tenantId: tenantId || null }
    });
    if (count > 0) return;

    await prisma.automationRule.createMany({
        data: DEFAULT_AUTOMATION_RULES.map((rule) => ({
            ...rule,
            tenantId: tenantId || null
        }))
    });
}

async function attachAssignees(rules) {
    const userIds = [
        ...new Set(rules.map((rule) => rule.assignToUserId).filter(Boolean))
    ];

    if (!userIds.length) {
        return rules.map((rule) => ({ ...rule, assignee: null }));
    }

    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: ASSIGNEE_SELECT
    });

    const byId = new Map(users.map((user) => [user.id, user]));

    return rules.map((rule) => ({
        ...rule,
        assignee: rule.assignToUserId
            ? byId.get(rule.assignToUserId) || null
            : null
    }));
}

/**
 * An assignee must be a member of the same workspace — otherwise the rule
 * would silently point at an agent the tenant cannot see.
 */
async function resolveAssignee(tenantId, userId) {
    if (!userId) return null;

    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            ...(tenantId ? { tenantId } : {})
        },
        select: { id: true }
    });

    if (!user) {
        throw new AppError("That agent is not part of this workspace", 400);
    }

    return user.id;
}

async function findRuleOrFail(tenantId, ruleId) {
    const rule = await prisma.automationRule.findFirst({
        where: { id: ruleId, tenantId: tenantId || null }
    });

    if (!rule) throw new AppError("Automation rule not found", 404);

    return rule;
}

export async function listAutomationRules(tenantId) {
    await ensureDefaultRules(tenantId);

    const rules = await prisma.automationRule.findMany({
        where: { tenantId: tenantId || null },
        orderBy: { createdAt: "asc" }
    });

    return {
        rules: await attachAssignees(rules),
        types: [...AUTOMATION_RULE_TYPES]
    };
}

export async function getAutomationRule(tenantId, ruleId) {
    const rule = await findRuleOrFail(tenantId, ruleId);
    const [hydrated] = await attachAssignees([rule]);
    return { rule: hydrated };
}

export async function createAutomationRule(tenantId, actorId, payload) {
    const assignToUserId = await resolveAssignee(
        tenantId,
        payload.assignToUserId || null
    );

    const rule = await prisma.automationRule.create({
        data: {
            tenantId: tenantId || null,
            name: payload.name.trim(),
            type: payload.type || "auto_acknowledge",
            description: payload.description?.trim() || null,
            assignToUserId,
            isActive: payload.isActive !== false,
            createdByUserId: actorId || null
        }
    });

    const [hydrated] = await attachAssignees([rule]);
    return { rule: hydrated };
}

export async function updateAutomationRule(tenantId, ruleId, payload) {
    await findRuleOrFail(tenantId, ruleId);

    const data = {};

    if (payload.name !== undefined) data.name = payload.name.trim();
    if (payload.type !== undefined) data.type = payload.type;
    if (payload.description !== undefined) {
        data.description = payload.description?.trim() || null;
    }
    if (payload.assignToUserId !== undefined) {
        data.assignToUserId = await resolveAssignee(
            tenantId,
            payload.assignToUserId || null
        );
    }
    if (payload.isActive !== undefined) data.isActive = Boolean(payload.isActive);

    if (!Object.keys(data).length) {
        throw new AppError("Nothing to update on this automation rule", 400);
    }

    const rule = await prisma.automationRule.update({
        where: { id: ruleId },
        data
    });

    const [hydrated] = await attachAssignees([rule]);
    return { rule: hydrated };
}

export async function deleteAutomationRule(tenantId, ruleId) {
    await findRuleOrFail(tenantId, ruleId);
    await prisma.automationRule.delete({ where: { id: ruleId } });
    return { deleted: true };
}

export default {
    listAutomationRules,
    getAutomationRule,
    createAutomationRule,
    updateAutomationRule,
    deleteAutomationRule
};

