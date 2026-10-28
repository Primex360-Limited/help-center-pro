/**
 * Maps each workspace module to the permission keys that unlock it.
 * If a user has none of a module's keys, that module must be invisible
 * in the sidebar and blocked by route guards.
 */

export const MODULE_ACCESS = Object.freeze({
  dashboard: ["ticket:read"],
  tickets: ["ticket:read"],
  liveChat: ["ticket:read"],
  emails: ["ticket:read"],
  calls: ["ticket:read"],
  customers: ["ticket:read", "message:create"],
  agents: ["agent:read", "agent:invite"],
  analytics: ["report:read"],
  reports: ["report:read"],
  templates: ["template:read"],
  automations: ["ticket:transfer", "ticket:assign", "ticket:supervise"],
  billing: ["settings:read", "settings:write"],
  userManagement: [
    "role:read",
    "role:manage",
    "agent:read",
    "agent:invite",
    "agent:update",
  ],
  settings: ["settings:read", "settings:write"],
});

/** Nav items that are product features but not yet available. */
export const COMING_SOON_MODULES = Object.freeze(new Set(["reports"]));
