import { z } from "zod";

/**
 * Automation rule types understood by the workspace UI.
 * Keep in sync with `help-centre-pro-frontend/src/constants/automationRules.js`.
 */
export const AUTOMATION_RULE_TYPES = Object.freeze([
    "auto_acknowledge",
    "auto_assign",
    "round_robin",
    "priority_escalation",
    "auto_close",
    "sla_reminder"
]);

const ruleTypeSchema = z.enum(AUTOMATION_RULE_TYPES, {
    message: "Choose a supported automation type"
});

const ruleNameSchema = z
    .string({ message: "Give this rule a name" })
    .trim()
    .min(2, "Give this rule a name with at least 2 characters")
    .max(80, "Rule names cannot be longer than 80 characters");

const descriptionSchema = z
    .string()
    .trim()
    .max(500, "Descriptions cannot be longer than 500 characters");

export const createAutomationRuleSchema = z.object({
    name: ruleNameSchema,
    type: ruleTypeSchema.optional(),
    description: descriptionSchema.optional(),
    assignToUserId: z.string().uuid("Assign this rule to a valid agent").nullish(),
    isActive: z.boolean().optional()
});

export const updateAutomationRuleSchema = z.object({
    name: ruleNameSchema.optional(),
    type: ruleTypeSchema.optional(),
    description: descriptionSchema.nullish(),
    assignToUserId: z.string().uuid("Assign this rule to a valid agent").nullish(),
    isActive: z.boolean().optional()
});

export const automationRuleIdParamSchema = z.object({
    ruleId: z.string().uuid("Automation rule not found")
});
