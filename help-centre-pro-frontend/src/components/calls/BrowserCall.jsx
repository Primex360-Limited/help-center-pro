import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { getVoiceToken } from "../../api/tickets.api.js";

/**
 * Lazy-load the Twilio Voice SDK so a missing/stale install can never
 * crash the whole app — browser calling simply reports unavailable.
 */
async function loadVoiceDevice() {
  const mod = await import("@twilio/voice-sdk");
  return mod.Device || mod.default?.Device || mod.default;
}

function formatTimer(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Browser voice via the HelpCentre Pro Twilio line.
 * Used when the agent has no handset number on their profile —
 * the agent talks through this device, the customer on normal PSTN.
 */
export function useBrowserCall({ onEnded } = {}) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [peer, setPeer] = useState("");
  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function cleanup() {
    stopTimer();
    try {
      callRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    callRef.current = null;
    try {
      deviceRef.current?.destroy();
    } catch {
      /* ignore */
    }
    deviceRef.current = null;
  }

  useEffect(() => cleanup, []);

  async function start({ to, ticketId, from }) {
    setError("");
    setMuted(false);
    setSeconds(0);
    setPeer(to || "");
    setStatus("connecting");
    cleanup();

    try {
      const result = await getVoiceToken();
      const data = result?.data || result;
      const token = data?.token;
      if (!token) {
        throw new Error("Browser voice is unavailable right now.");
      }

      const DeviceCtor = await loadVoiceDevice();
      if (!DeviceCtor) {
        throw new Error(
          "Browser voice is unavailable in this build. Save your agent phone in My profile to call from your handset instead."
        );
      }

      const device = new DeviceCtor(token, {
        logLevel: "error",
        codecPreferences: ["opus", "pcmu"],
      });
      deviceRef.current = device;

      device.on("error", (err) => {
        setError(err?.message || "Browser voice error");
        setStatus("error");
        cleanup();
      });

      await device.register();

      const call = await device.connect({
        params: {
          To: to,
          ticketId: ticketId || "",
          from: from || data?.from || "",
        },
      });
      callRef.current = call;

      call.on("ringing", () => setStatus("ringing"));
      call.on("accept", () => {
        setStatus("in-progress");
        stopTimer();
        timerRef.current = setInterval(
          () => setSeconds((v) => v + 1),
          1000
        );
      });
      const finish = () => {
        setStatus("ended");
        stopTimer();
        cleanup();
        onEndedRef.current?.();
      };
      call.on("disconnect", finish);
      call.on("cancel", finish);
      call.on("reject", finish);
      call.on("error", (err) => {
        setError(err?.message || "Call failed");
        setStatus("error");
        cleanup();
      });

      return call;
    } catch (err) {
      setStatus("error");
      setError(
        err?.message ||
          "Unable to start browser call. Check microphone access and browser voice configuration."
      );
      cleanup();
      throw err;
    }
  }

  function hangUp() {
    try {
      callRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    cleanup();
    setStatus("ended");
    onEndedRef.current?.();
  }

  function toggleMute() {
    const call = callRef.current;
    if (!call) return;
    const next = !muted;
    call.mute(next);
    setMuted(next);
  }

  const active = ["connecting", "ringing", "in-progress"].includes(status);

  return {
    status,
    error,
    muted,
    seconds,
    peer,
    active,
    start,
    hangUp,
    toggleMute,
  };
}

export function InCallBar({ call, label }) {
  if (!call || (call.status === "idle" && !call.error)) return null;

  const statusLabel =
    call.status === "connecting"
      ? "Connecting…"
      : call.status === "ringing"
        ? "Ringing customer…"
        : call.status === "in-progress"
          ? `On call · ${formatTimer(call.seconds)}`
          : call.status === "ended"
            ? "Call ended"
            : call.status === "error"
              ? "Call failed"
              : "";

  return (
    <div
      className={`ch-incall${call.active ? " is-live" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="ch-incall__pulse" aria-hidden="true" />
      <div className="ch-incall__meta">
        <strong>{label || "HelpCentre Pro line"}</strong>
        <span>
          {statusLabel}
          {call.peer ? ` · ${call.peer}` : ""}
        </span>
        {call.error ? <span className="ch-incall__error">{call.error}</span> : null}
      </div>
      {call.active ? (
        <div className="ch-incall__actions">
          <button
            type="button"
            className="ch-incall__btn"
            onClick={call.toggleMute}
            aria-label={call.muted ? "Unmute" : "Mute"}
          >
            {call.muted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            type="button"
            className="ch-incall__btn ch-incall__btn--end"
            onClick={call.hangUp}
            aria-label="End call"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { formatTimer };
