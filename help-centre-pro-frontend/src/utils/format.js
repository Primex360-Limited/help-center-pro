export function formatNumber(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * Display ticket IDs exactly like the product UI: TK-00001 (no suffixes).
 */
export function formatTicketId(ticketId) {
  if (!ticketId) return "—";
  const raw = String(ticketId).trim();

  const tk = raw.match(/^TK-0*(\d+)$/i);
  if (tk) return `TK-${String(Number(tk[1])).padStart(5, "0")}`;

  // Strip legacy channel suffixes: TK-00012-CALL02 → TK-00012
  const stripped = raw.replace(/-(CALL|CHAT|EMAIL|MAIL|PHONE)[A-Z0-9]*$/i, "");
  const tkStripped = stripped.match(/^TK-0*(\d+)$/i);
  if (tkStripped) {
    return `TK-${String(Number(tkStripped[1])).padStart(5, "0")}`;
  }

  // Legacy TCKT-YYYYMMDD-CALL02 → TK-XXXXX from trailing digits when possible
  const legacyTail = raw.match(/(?:CALL|CHAT|EMAIL|MAIL)?0*(\d{1,5})$/i);
  if (/^TCKT-/i.test(raw) && legacyTail) {
    return `TK-${String(Number(legacyTail[1])).padStart(5, "0")}`;
  }

  return raw;
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
