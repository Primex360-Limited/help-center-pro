/** Shared member display helpers used by the roster and the edit dialog. */

const ROLE_LABELS = {
  "Tenant Admin": "Admin",
  Admin: "Admin",
  "Tenant Supervisor": "Supervisor",
  Supervisor: "Supervisor",
  "Tenant Agent": "Agent",
  Agent: "Agent",
};

export function roleDisplayName(name = "") {
  return ROLE_LABELS[name] || name || "No role";
}

/** Falls back to the email local-part when the profile has no real name yet. */
export function displayNameOf(user) {
  const local = user?.email?.split("@")[0] || "";
  if (!user?.lastName || user.lastName === "User") {
    return local || user?.firstName || "Teammate";
  }
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    local ||
    "Teammate"
  );
}

/** Maps both Phase-1 (`invited`) and legacy (`pending`) statuses. */
export function normalizedStatus(user) {
  const raw = String(user?.status || "").toLowerCase();
  if (raw === "active") return "active";
  if (raw === "invited" || raw === "pending") return "pending";
  if (raw === "suspended") return "suspended";
  return "inactive";
}
