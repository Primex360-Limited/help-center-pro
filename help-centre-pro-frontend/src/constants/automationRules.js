import {
  AlertTriangle,
  Archive,
  MailCheck,
  Shuffle,
  Timer,
  UserPlus,
  Zap,
} from "lucide-react";

/**
 * Automation rule catalog.
 *
 * Values mirror `FUMS-HELP-CENTER-PRO-main/src/modules/automations/automation.validation.js`
 * — the API rejects anything that is not in that list. Copy, tone and icon are
 * presentation-only.
 */
export const AUTOMATION_RULE_TYPES = [
  {
    value: "auto_acknowledge",
    label: "Auto-Acknowledge",
    tagline: "Instant first reply",
    description:
      "Send your acknowledgement template the moment a ticket arrives so no customer waits in silence.",
    tone: "info",
    icon: MailCheck,
    needsAssignee: false,
  },
  {
    value: "auto_assign",
    label: "Auto-Assign",
    tagline: "Route to one agent",
    description:
      "Hand every matching ticket straight to one teammate — ideal for billing, VIP or onboarding queues.",
    tone: "violet",
    icon: UserPlus,
    needsAssignee: true,
  },
  {
    value: "round_robin",
    label: "Round Robin",
    tagline: "Balance the queue",
    description:
      "Rotate new tickets across the team so the workload stays even and nobody is buried.",
    tone: "success",
    icon: Shuffle,
    needsAssignee: false,
  },
  {
    value: "priority_escalation",
    label: "Priority Escalation",
    tagline: "Catch the urgent ones",
    description:
      "Raise priority and notify a lead the moment risky words like outage, refund or downtime appear.",
    tone: "danger",
    icon: AlertTriangle,
    needsAssignee: false,
  },
  {
    value: "auto_close",
    label: "Auto-Close",
    tagline: "Tidy stale tickets",
    description:
      "Close conversations that have gone quiet for a set number of hours, with a polite closing note.",
    tone: "neutral",
    icon: Archive,
    needsAssignee: false,
  },
  {
    value: "sla_reminder",
    label: "SLA Reminder",
    tagline: "Beat the clock",
    description:
      "Nudge the assignee before a first-response or resolution target is missed.",
    tone: "warning",
    icon: Timer,
    needsAssignee: false,
  },
];

const FALLBACK_TYPE = {
  value: "custom",
  label: "Custom rule",
  tagline: "Workspace rule",
  description: "A custom automation configured for this workspace.",
  tone: "neutral",
  icon: Zap,
  needsAssignee: false,
};

function humanize(value) {
  const text = String(value || "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!text) return "Automation";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Catalog entry for a stored type, with a safe fallback for legacy values. */
export function automationRuleType(value) {
  const known = AUTOMATION_RULE_TYPES.find((type) => type.value === value);
  if (known) return known;

  return {
    ...FALLBACK_TYPE,
    value: value || FALLBACK_TYPE.value,
    label: humanize(value),
    tagline: "Custom automation",
  };
}

/** "Ada Lovelace" from an API agent record. */
export function agentName(agent) {
  if (!agent) return "";
  const name = [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim();
  return name || agent.email || "Unknown agent";
}

/** Two-letter avatar text for an agent record. */
export function agentInitials(agent) {
  if (!agent) return "?";
  const source = agentName(agent);
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/** Short, locale-aware "22 Oct 2026". */
export function formatRuleDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
