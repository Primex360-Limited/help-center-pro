import { useEffect, useRef, useState } from "react";
import {
  Grid3X3,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneForwarded,
  PhoneOff,
  Play,
  Circle,
} from "lucide-react";
import {
  completeSipCall,
  startInboundSipCall,
} from "../../api/tickets.api.js";
import voipService from "../../services/voipService.js";

function formatTimer(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function pushLog(logsRef, entry) {
  logsRef.current = [...logsRef.current, entry];
}

/**
 * Browser softphone via the tenant's active VoIP/SIP provider (JsSIP).
 * Records audio, tracks quality, hold/DTMF/transfer, and completes the call ticket.
 */
export function useBrowserCall({ onEnded } = {}) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [peer, setPeer] = useState("");
  const [providerName, setProviderName] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [callSid, setCallSid] = useState("");
  const [direction, setDirection] = useState("OUTBOUND");

  const timerRef = useRef(null);
  const secondsRef = useRef(0);
  const ticketIdRef = useRef("");
  const callSidRef = useRef("");
  const peerRef = useRef("");
  const directionRef = useRef("OUTBOUND");
  const logsRef = useRef([]);
  const speechRef = useRef(null);
  const handlersRef = useRef(null);
  const finalizingRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function stopSpeechRecognition() {
    try {
      speechRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    speechRef.current = null;
  }

  function startSpeechRecognition() {
    stopSpeechRecognition();
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (!result?.isFinal) continue;
          const text = String(result[0]?.transcript || "").trim();
          if (!text) continue;
          pushLog(logsRef, {
            speaker: "Agent",
            role: "speech",
            text,
            time: formatTimer(secondsRef.current),
          });
        }
      };
      recognition.onerror = () => {};
      recognition.start();
      speechRef.current = recognition;
    } catch {
      /* unsupported / permission denied */
    }
  }

  async function beginRecording() {
    try {
      if (!voipService.shouldRecord(directionRef.current)) {
        setRecording(false);
        pushLog(logsRef, {
          speaker: "System",
          role: "recording",
          text: "Recording disabled for this call direction",
          time: formatTimer(secondsRef.current),
        });
        return;
      }
      await voipService.startRecording();
      setRecording(true);
      pushLog(logsRef, {
        speaker: "System",
        role: "recording",
        text: "Call recording started",
        time: formatTimer(secondsRef.current),
      });
    } catch (err) {
      console.warn("Recording unavailable:", err?.message || err);
      setRecording(false);
    }
  }

  async function finalizeCall(finalStatus = "completed") {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    const tid = ticketIdRef.current;
    if (!tid) {
      finalizingRef.current = false;
      return;
    }

    stopSpeechRecognition();
    setRecording(false);

    // Prefer artifacts captured while the peer connection was still alive.
    let { recordingDataUrl, quality } = voipService.consumeCallArtifacts();
    if (!recordingDataUrl) {
      try {
        recordingDataUrl = await voipService.stopRecording();
      } catch {
        recordingDataUrl = null;
      }
    }
    if (!quality) {
      try {
        quality = await voipService.collectQualityStats();
      } catch {
        quality = null;
      }
    }

    pushLog(logsRef, {
      speaker: "System",
      role: "hangup",
      text: `Call ${finalStatus} · duration ${formatTimer(secondsRef.current)}`,
      time: formatTimer(secondsRef.current),
    });

    try {
      await completeSipCall({
        ticketId: tid,
        callSid: callSidRef.current || undefined,
        durationSeconds: secondsRef.current,
        status: finalStatus,
        recordingDataUrl: recordingDataUrl || undefined,
        transcript: logsRef.current,
        quality: quality || undefined,
      });
    } catch (err) {
      console.warn("Failed to complete SIP call on ticket:", err?.message || err);
    } finally {
      finalizingRef.current = false;
    }
  }

  function unbindSoftphoneEvents() {
    const handlers = handlersRef.current;
    if (!handlers) return;
    voipService.off("ringing", handlers.ringing);
    voipService.off("connected", handlers.connected);
    voipService.off("ended", handlers.ended);
    voipService.off("error", handlers.error);
    handlersRef.current = null;
  }

  function cleanupMediaOnly() {
    stopTimer();
    unbindSoftphoneEvents();
    stopSpeechRecognition();
    setHeld(false);
    setShowKeypad(false);
    setShowTransfer(false);
  }

  function cleanup() {
    cleanupMediaOnly();
    try {
      voipService.hangup();
    } catch {
      /* ignore */
    }
  }

  useEffect(() => cleanup, []);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);
  useEffect(() => {
    ticketIdRef.current = ticketId;
  }, [ticketId]);
  useEffect(() => {
    callSidRef.current = callSid;
  }, [callSid]);
  useEffect(() => {
    peerRef.current = peer;
  }, [peer]);
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  function bindSoftphoneEvents() {
    unbindSoftphoneEvents();
    const handlers = {
      ringing: () => {
        setStatus("ringing");
        pushLog(logsRef, {
          speaker: "System",
          role: "ringing",
          text: "Ringing…",
          time: formatTimer(secondsRef.current),
        });
      },
      connected: () => {
        setStatus("in-progress");
        stopTimer();
        timerRef.current = setInterval(() => {
          setSeconds((v) => {
            const next = v + 1;
            secondsRef.current = next;
            return next;
          });
        }, 1000);
        pushLog(logsRef, {
          speaker: "System",
          role: "connected",
          text: "Call connected",
          time: formatTimer(secondsRef.current),
        });
        beginRecording();
        startSpeechRecognition();
      },
      ended: async () => {
        setStatus("ended");
        stopTimer();
        await finalizeCall("completed");
        cleanupMediaOnly();
        onEndedRef.current?.({
          ticketId: ticketIdRef.current,
          duration: secondsRef.current,
        });
      },
      error: async (err) => {
        setError(err?.message || "Call failed");
        setStatus("error");
        await finalizeCall("failed");
        cleanupMediaOnly();
      },
    };
    handlersRef.current = handlers;
    voipService.on("ringing", handlers.ringing);
    voipService.on("connected", handlers.connected);
    voipService.on("ended", handlers.ended);
    voipService.on("error", handlers.error);
  }

  function resetCallState({ to, tid, sid, dir }) {
    finalizingRef.current = false;
    setError("");
    setMuted(false);
    setHeld(false);
    setRecording(false);
    setShowKeypad(false);
    setShowTransfer(false);
    setTransferTo("");
    setSeconds(0);
    secondsRef.current = 0;
    setPeer(to || "");
    peerRef.current = to || "";
    setTicketId(tid || "");
    ticketIdRef.current = tid || "";
    setCallSid(sid || "");
    callSidRef.current = sid || "";
    setDirection(dir || "OUTBOUND");
    directionRef.current = dir || "OUTBOUND";
    logsRef.current = [
      {
        speaker: "System",
        role: "initiated",
        text:
          dir === "INBOUND"
            ? `Inbound call from ${to || "unknown"}`
            : `Outbound call to ${to || "unknown"}`,
        time: "0:00",
      },
    ];
  }

  async function start({ to, ticketId: tid, from, callSid: sid }) {
    resetCallState({ to, tid, sid, dir: "OUTBOUND" });
    setStatus("connecting");
    cleanup();

    try {
      await voipService.initialize({ force: true });
      setProviderName(voipService.provider?.name || "VoIP / SIP");
      bindSoftphoneEvents();

      return await voipService.makeCall({
        to,
        from,
        ticketId: tid,
        metadata: { ticketId: tid },
      });
    } catch (err) {
      setStatus("error");
      setError(
        err?.message ||
          "Unable to start call. Configure a VoIP/SIP provider in Settings → VoIP/SIP and allow microphone access."
      );
      cleanup();
      throw err;
    }
  }

  async function answerIncoming(session, meta = {}) {
    const caller =
      voipService.getIncomingCaller(session) || meta.from || "Unknown";
    resetCallState({ to: caller, tid: "", sid: "", dir: "INBOUND" });
    setStatus("connecting");

    try {
      await voipService.initialize({ force: !voipService.initialized });
      setProviderName(voipService.provider?.name || "VoIP / SIP");
      bindSoftphoneEvents();

      const inbound = await startInboundSipCall({
        from: caller,
        customerName: meta.customerName,
        customerEmail: meta.customerEmail,
        title: meta.title,
        defaultRegion: meta.defaultRegion || "NG",
      });
      const data = inbound?.data || inbound;
      setTicketId(data?.ticketId || "");
      ticketIdRef.current = data?.ticketId || "";
      setCallSid(data?.callSid || "");
      callSidRef.current = data?.callSid || "";

      await voipService.acceptCall(session);
      setStatus("in-progress");
      stopTimer();
      timerRef.current = setInterval(() => {
        setSeconds((v) => {
          const next = v + 1;
          secondsRef.current = next;
          return next;
        });
      }, 1000);
      pushLog(logsRef, {
        speaker: "System",
        role: "answered",
        text: "Inbound call answered",
        time: "0:00",
      });
      beginRecording();
      startSpeechRecognition();

      return data;
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to answer inbound call");
      try {
        await voipService.rejectCall(session);
      } catch {
        /* ignore */
      }
      cleanup();
      throw err;
    }
  }

  function hangUp() {
    try {
      voipService.hangup();
    } catch {
      /* ignore */
    }
    if (status !== "ended") {
      setStatus("ended");
      stopTimer();
    }
  }

  function toggleMute() {
    if (held) return;
    const next = !muted;
    voipService.toggleMute(next);
    setMuted(next);
    pushLog(logsRef, {
      speaker: "System",
      role: "mute",
      text: next ? "Microphone muted" : "Microphone unmuted",
      time: formatTimer(secondsRef.current),
    });
  }

  function toggleHold() {
    const next = !held;
    voipService.setHold(next);
    setHeld(next);
    if (next) setMuted(true);
    pushLog(logsRef, {
      speaker: "System",
      role: "hold",
      text: next ? "Call placed on hold" : "Call resumed",
      time: formatTimer(secondsRef.current),
    });
  }

  function sendDigit(digit) {
    voipService.sendDtmf(digit);
    pushLog(logsRef, {
      speaker: "Agent",
      role: "dtmf",
      text: `DTMF ${digit}`,
      time: formatTimer(secondsRef.current),
    });
  }

  async function transferCall() {
    const target = transferTo.trim();
    if (!target) return;
    try {
      await voipService.transfer(target);
      pushLog(logsRef, {
        speaker: "System",
        role: "transfer",
        text: `Transferred to ${target}`,
        time: formatTimer(secondsRef.current),
      });
      setShowTransfer(false);
    } catch (err) {
      setError(err?.message || "Transfer failed");
    }
  }

  const active = ["connecting", "ringing", "in-progress"].includes(status);

  return {
    status,
    error,
    muted,
    held,
    recording,
    showKeypad,
    setShowKeypad,
    showTransfer,
    setShowTransfer,
    transferTo,
    setTransferTo,
    seconds,
    peer,
    active,
    providerName,
    ticketId,
    callSid,
    direction,
    start,
    answerIncoming,
    hangUp,
    toggleMute,
    toggleHold,
    sendDigit,
    transferCall,
  };
}

export function InCallBar({ call, label }) {
  if (!call || (call.status === "idle" && !call.error)) return null;

  const statusLabel =
    call.status === "connecting"
      ? "Connecting…"
      : call.status === "ringing"
        ? "Ringing…"
        : call.status === "in-progress"
          ? call.held
            ? `On hold · ${formatTimer(call.seconds)}`
            : `On call · ${formatTimer(call.seconds)}`
          : call.status === "ended"
            ? "Call ended"
            : call.status === "error"
              ? "Call failed"
              : "";

  return (
    <div
      className={`ch-incall${call.active ? " is-live" : ""}${call.held ? " is-held" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="ch-incall__pulse" aria-hidden="true" />
      <div className="ch-incall__meta">
        <strong>{label || call.providerName || "VoIP / SIP line"}</strong>
        <span>
          {statusLabel}
          {call.peer ? ` · ${call.peer}` : ""}
          {call.recording ? " · Recording" : ""}
        </span>
        {call.error ? <span className="ch-incall__error">{call.error}</span> : null}
      </div>
      {call.active ? (
        <div className="ch-incall__actions">
          <button
            type="button"
            className={`ch-incall__btn${call.muted ? " is-on" : ""}`}
            onClick={call.toggleMute}
            aria-label={call.muted ? "Unmute" : "Mute"}
            title={call.muted ? "Unmute" : "Mute"}
            disabled={call.held}
          >
            {call.muted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            type="button"
            className={`ch-incall__btn${call.held ? " is-on" : ""}`}
            onClick={call.toggleHold}
            aria-label={call.held ? "Resume" : "Hold"}
            title={call.held ? "Resume" : "Hold"}
          >
            {call.held ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            type="button"
            className={`ch-incall__btn${call.showKeypad ? " is-on" : ""}`}
            onClick={() => call.setShowKeypad?.(!call.showKeypad)}
            aria-label="Keypad"
            title="Keypad"
          >
            <Grid3X3 size={16} />
          </button>
          <button
            type="button"
            className={`ch-incall__btn${call.showTransfer ? " is-on" : ""}`}
            onClick={() => call.setShowTransfer?.(!call.showTransfer)}
            aria-label="Transfer"
            title="Transfer"
          >
            <PhoneForwarded size={16} />
          </button>
          <span
            className={`ch-incall__rec${call.recording ? " is-live" : ""}`}
            title={call.recording ? "Recording" : "Not recording"}
          >
            <Circle size={10} fill={call.recording ? "currentColor" : "none"} />
          </span>
          <button
            type="button"
            className="ch-incall__btn ch-incall__btn--end"
            onClick={call.hangUp}
            aria-label="End call"
            title="End call"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      ) : null}

      {call.active && call.showKeypad ? (
        <div className="ch-incall__keypad" role="group" aria-label="DTMF keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(
            (digit) => (
              <button
                key={digit}
                type="button"
                className="ch-incall__key"
                onClick={() => call.sendDigit?.(digit)}
              >
                {digit}
              </button>
            )
          )}
        </div>
      ) : null}

      {call.active && call.showTransfer ? (
        <div className="ch-incall__transfer">
          <input
            className="ch-input"
            value={call.transferTo || ""}
            onChange={(e) => call.setTransferTo?.(e.target.value)}
            placeholder="Transfer to number or SIP URI"
            aria-label="Transfer target"
          />
          <button
            type="button"
            className="ch-btn ch-btn--call"
            onClick={call.transferCall}
            disabled={!String(call.transferTo || "").trim()}
          >
            Transfer
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function IncomingCallBanner({
  session,
  onAccept,
  onReject,
  accepting = false,
}) {
  if (!session) return null;
  const caller = voipService.getIncomingCaller(session) || "Unknown caller";

  return (
    <div className="ch-incoming" role="alertdialog" aria-label="Incoming call">
      <div className="ch-incoming__pulse" aria-hidden="true" />
      <div className="ch-incoming__meta">
        <strong>Incoming call</strong>
        <span>{caller}</span>
      </div>
      <div className="ch-incoming__actions">
        <button
          type="button"
          className="ch-incoming__btn ch-incoming__btn--decline"
          onClick={onReject}
          disabled={accepting}
        >
          <PhoneOff size={16} />
          Decline
        </button>
        <button
          type="button"
          className="ch-incoming__btn ch-incoming__btn--accept"
          onClick={onAccept}
          disabled={accepting}
        >
          <Phone size={16} />
          {accepting ? "Answering…" : "Answer"}
        </button>
      </div>
    </div>
  );
}

export { formatTimer };
