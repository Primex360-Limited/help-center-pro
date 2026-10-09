export function formatNumber(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("en-US").format(num);
}

export function statusLabel(status = "") {
  const map = {
    OPEN: "Open",
    QUEUED: "Queued",
    PENDING: "Pending",
    WAITING_FOR_REPLY: "Waiting",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  };
  return map[status] || status;
}

export function priorityLabel(priority = "") {
  const map = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
  };
  return map[priority] || priority;
}
