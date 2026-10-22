/**
 * Canonical permission catalog for the tenant workspace.
 *
 * Keys mirror `FUMS-HELP-CENTER-PRO-main/src/shared/constants/permissions.js`
 * exactly — the API rejects anything that is not in that catalog. Groups are
 * presentation-only and exist so the role editor can render tidy sections.
 */

export const ROLE_PERMISSION_GROUPS = [
  {
    id: "ticket",
    label: "Tickets",
    description: "The shared inbox and every action inside a ticket.",
    permissions: [
      {
        key: "ticket:read",
        label: "View tickets",
        description: "Open the inbox and read any ticket",
      },
      {
        key: "ticket:create",
        label: "Create tickets",
        description: "Raise new tickets on behalf of customers",
      },
      {
        key: "ticket:update",
        label: "Edit tickets",
        description: "Change details, tags and custom fields",
      },
      {
        key: "ticket:assign",
        label: "Assign tickets",
        description: "Hand a ticket to a teammate",
      },
      {
        key: "ticket:transfer",
        label: "Transfer tickets",
        description: "Move tickets between teams or inboxes",
      },
      {
        key: "ticket:pick",
        label: "Pick up tickets",
        description: "Claim unassigned work from the queue",
      },
      {
        key: "ticket:close",
        label: "Close tickets",
        description: "Resolve, close and reopen conversations",
      },
      {
        key: "ticket:supervise",
        label: "Supervise tickets",
        description: "Oversee every queue and reassign work",
      },
    ],
  },
  {
    id: "conversation",
    label: "Conversations",
    description: "What members can send to customers and to each other.",
    permissions: [
      {
        key: "message:create",
        label: "Reply to customers",
        description: "Send public replies from the inbox",
      },
      {
        key: "note:create",
        label: "Add internal notes",
        description: "Leave private notes for the team",
      },
    ],
  },
  {
    id: "template",
    label: "Templates",
    description: "Saved replies and reusable customer messaging.",
    permissions: [
      {
        key: "template:read",
        label: "View templates",
        description: "Browse the workspace template library",
      },
      {
        key: "template:create",
        label: "Create templates",
        description: "Add new saved replies",
      },
      {
        key: "template:update",
        label: "Edit templates",
        description: "Update wording and placeholders",
      },
      {
        key: "template:delete",
        label: "Delete templates",
        description: "Remove templates permanently",
      },
    ],
  },
  {
    id: "agent",
    label: "Team & agents",
    description: "Inviting teammates and managing their access.",
    permissions: [
      {
        key: "agent:read",
        label: "View teammates",
        description: "See the member directory and workload",
      },
      {
        key: "agent:invite",
        label: "Invite teammates",
        description: "Send workspace invitations",
      },
      {
        key: "agent:update",
        label: "Edit teammates",
        description: "Change profile details and assigned role",
      },
      {
        key: "agent:deactivate",
        label: "Deactivate teammates",
        description: "Revoke workspace access",
      },
    ],
  },
  {
    id: "role",
    label: "Roles & permissions",
    description: "Defining what each role in this workspace can do.",
    permissions: [
      {
        key: "role:read",
        label: "View roles",
        description: "See every role and its permissions",
      },
      {
        key: "role:manage",
        label: "Manage roles",
        description: "Create, edit and assign custom roles",
      },
    ],
  },
  {
    id: "settings",
    label: "Workspace settings",
    description: "Company profile, channels and integrations.",
    permissions: [
      {
        key: "settings:read",
        label: "View settings",
        description: "Open workspace configuration",
      },
      {
        key: "settings:write",
        label: "Edit settings",
        description: "Change workspace-wide configuration",
      },
    ],
  },
  {
    id: "report",
    label: "Reporting",
    description: "Performance and volume insights.",
    permissions: [
      {
        key: "report:read",
        label: "View reports",
        description: "Open analytics, exports and dashboards",
      },
    ],
  },
];

export const ALL_ROLE_PERMISSIONS = ROLE_PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => ({
    ...permission,
    groupId: group.id,
    groupLabel: group.label,
  }))
);

export const TOTAL_ROLE_PERMISSIONS = ALL_ROLE_PERMISSIONS.length;

const PERMISSION_BY_KEY = new Map(
  ALL_ROLE_PERMISSIONS.map((permission) => [permission.key, permission])
);

/** Human label for any key, including legacy entries returned by the API. */
export function permissionLabel(key) {
  const known = PERMISSION_BY_KEY.get(key);
  if (known) return known.label;

  const fallback = String(key || "")
    .split(":")
    .pop()
    ?.replace(/[-_]/g, " ");

  return fallback
    ? fallback.charAt(0).toUpperCase() + fallback.slice(1)
    : "Permission";
}

/** The catalog entry, or a synthetic one so unknown keys still render. */
export function permissionMeta(key) {
  return (
    PERMISSION_BY_KEY.get(key) || {
      key,
      label: permissionLabel(key),
      description: "Granted by this role",
      groupId: "other",
      groupLabel: "Other access",
    }
  );
}

/** Normalizes `["ticket:read"]` or `[{ key }]` into a unique key list. */
export function permissionKeysOf(role) {
  const raw = role?.permissions;
  if (!Array.isArray(raw)) return [];

  const keys = raw
    .map((entry) => (typeof entry === "string" ? entry : entry?.key))
    .filter(Boolean);

  return Array.from(new Set(keys));
}
