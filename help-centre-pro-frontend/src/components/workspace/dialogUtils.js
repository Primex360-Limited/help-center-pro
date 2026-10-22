import { useEffect } from "react";

/** Locks the page behind a dialog and wires Escape to close. */
export function useDialogChrome(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);
}

/** "2h ago" / "Mar 4, 2025" — compact enough for table rows. */
export function relativeTime(value) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";

  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

/** Full date + time, used as the `title` on relative timestamps. */
export function fullDateTime(value) {
  if (!value) return "No activity recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity recorded";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const AVATAR_PALETTES = [
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #0ea5e9, #2563eb)",
  "linear-gradient(135deg, #10b981, #0d9488)",
  "linear-gradient(135deg, #f59e0b, #ea580c)",
  "linear-gradient(135deg, #ec4899, #db2777)",
  "linear-gradient(135deg, #8b5cf6, #d946ef)",
];

/** Deterministic, calm gradient per person. */
export function avatarStyle(seed = "") {
  let hash = 0;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 9973;
  }
  return { backgroundImage: AVATAR_PALETTES[hash % AVATAR_PALETTES.length] };
}

export function initialsOf(firstName = "", lastName = "") {
  const first = String(firstName || "").trim().charAt(0);
  const last = String(lastName || "").trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  return initials || "?";
}
