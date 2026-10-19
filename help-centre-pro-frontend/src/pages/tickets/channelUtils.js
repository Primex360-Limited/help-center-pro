export const AVATAR_TONES = ["blue", "violet", "orange", "green", "rose", "teal"];

export const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "PENDING", label: "Pending" },
  { value: "WAITING_FOR_REPLY", label: "Waiting" },
  { value: "QUEUED", label: "Queued" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

export const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

/** Mirrors backend status.rules.js — only offer valid next statuses. */
export const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  QUEUED: ["OPEN", "CLOSED"],
  OPEN: ["PENDING", "WAITING_FOR_REPLY", "RESOLVED", "CLOSED"],
  PENDING: ["OPEN", "WAITING_FOR_REPLY", "RESOLVED", "CLOSED"],
  WAITING_FOR_REPLY: ["OPEN", "PENDING", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: [],
});

export function statusOptionsFor(currentStatus) {
  const current = String(currentStatus || "").toUpperCase();
  const allowed = new Set(ALLOWED_STATUS_TRANSITIONS[current] || []);
  return STATUS_OPTIONS.filter(
    (opt) => opt.value === current || allowed.has(opt.value)
  );
}

export function channelTicketPath(ticket) {
  const channel = ticketChannel(ticket);
  const id = ticket?.ticketId || ticket?.id;
  if (!id) return "/tickets";
  const enc = encodeURIComponent(id);
  if (channel === "CHAT") return `/tickets/live-chat?ticket=${enc}`;
  if (channel === "EMAIL") return `/tickets/emails?ticket=${enc}&view=thread`;
  if (channel === "PHONE") return `/tickets/calls?ticket=${enc}`;
  return `/tickets/live-chat?ticket=${enc}`;
}

export function ticketChannel(ticket) {
  return String(ticket?.channel || ticket?.sourceChannel || "MANUAL").toUpperCase();
}

export function initialsFromName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

export function avatarTone(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  }
  return AVATAR_TONES[hash];
}

export function formatRelative(value) {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function customerName(ticket) {
  return (
    ticket?.customer?.name ||
    ticket?.customer?.email ||
    ticket?.customer?.phone ||
    ticket?.title ||
    "Customer"
  );
}

export function customerEmail(ticket) {
  return ticket?.customer?.email || "";
}

export function customerPhone(ticket) {
  return ticket?.customer?.phone || "";
}

export function previewText(ticket, max = 72) {
  const text = ticket?.description || ticket?.title || "No messages yet";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function statusTone(status) {
  if (status === "OPEN" || status === "QUEUED") return "open";
  if (status === "PENDING" || status === "WAITING_FOR_REPLY") return "pending";
  if (status === "RESOLVED") return "resolved";
  return "closed";
}

export function priorityTone(priority) {
  if (priority === "HIGH") return "high";
  if (priority === "MEDIUM") return "medium";
  return "low";
}

export function extractCustomersFromTickets(tickets = []) {
  const map = new Map();
  tickets.forEach((ticket) => {
    const email = String(ticket?.customer?.email || "").trim().toLowerCase();
    const phone = String(ticket?.customer?.phone || "").trim();
    const name = String(ticket?.customer?.name || "").trim();
    const key = email || phone || ticket?.customer?.customerId || name;
    if (!key) return;
    if (map.has(key)) return;
    map.set(key, {
      key,
      name: name || email || phone || "Customer",
      email,
      phone,
      customerId: ticket?.customer?.customerId || "",
      company: ticket?.customer?.company || "",
    });
  });
  return Array.from(map.values());
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function unwrapThread(result) {
  const data = result?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.thread)) return data.thread;
  if (Array.isArray(data?.events)) return data.events;
  return [];
}

export function findCallEvent(thread = []) {
  return (
    thread.find(
      (event) =>
        String(event?.type || "").toUpperCase() === "CALL" ||
        String(event?.channel || "").toUpperCase() === "PHONE"
    ) || null
  );
}

export function collectTranscript(thread = []) {
  const lines = [];
  thread.forEach((event) => {
    const type = String(event?.type || "").toUpperCase();
    const channel = String(event?.channel || "").toUpperCase();
    if (type === "CALL" || channel === "PHONE") {
      const meta = event?.content || event?.metadata || {};
      const transcript = meta.transcript || meta.transcriptText;
      if (Array.isArray(transcript)) {
        transcript.forEach((row) => {
          lines.push({
            speaker: row.speaker || row.name || row.role || "Speaker",
            role: row.role || "",
            text: row.text || row.message || "",
            time: row.time || row.at || row.timestamp || "",
            initials: initialsFromName(row.speaker || row.name || "SP"),
          });
        });
      } else if (typeof transcript === "string" && transcript.trim()) {
        lines.push({
          speaker: "Transcript",
          role: "",
          text: transcript.trim(),
          time: "",
          initials: "TR",
        });
      }
      const logs = meta.logs;
      if (Array.isArray(logs)) {
        logs.forEach((log) => {
          if (log.note || log.message) {
            lines.push({
              speaker: log.actor || "System",
              role: log.eventType || "",
              text: log.note || log.message,
              time: log.timestamp
                ? new Date(log.timestamp).toLocaleTimeString(undefined, {
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "",
              initials: initialsFromName(log.actor || "SY"),
            });
          }
        });
      }
    }
  });
  return lines;
}

export function callQualityFromEvent(callEvent) {
  const content = callEvent?.content || {};
  const meta = callEvent?.metadata || {};
  const quality = content.quality || meta.quality || content.callQuality || null;
  if (!quality || typeof quality !== "object") return null;
  return quality;
}
