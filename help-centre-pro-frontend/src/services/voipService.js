/**
 * Browser softphone via JsSIP — works with any tenant-configured VoIP/SIP provider.
 * No paid CPaaS SDKs (Twilio, etc.).
 */

import { getVoipSettings, discoverVoipWebSocket } from "../api/workspace.api.js";
import { SIP_DEFAULT_WSS } from "../config/env.js";
import { getProviderById, resolveSipCredentials } from "../constants/voipProviders.js";
import {
  invalidateWsCache,
  normalizeWsUrl,
  providerWebDomain,
  resolveSipWebSocket,
} from "../utils/sipWebSocket.js";

function pickSipHost(credentials = {}) {
  return (
    credentials.sipServer ||
    credentials.sipDomain ||
    credentials.sipHost ||
    credentials.sipRealm ||
    credentials.sipRegistrar ||
    credentials.sipEndpoint ||
    credentials.sipProxy ||
    credentials.sipGateway ||
    credentials.sipTrunk ||
    credentials.ipAddress ||
    credentials.ip ||
    ""
  );
}

function pickSipUser(credentials = {}) {
  return (
    credentials.sipUsername ||
    credentials.sipUser ||
    credentials.sipAuthUser ||
    credentials.sipExtension ||
    credentials.sipAuth ||
    ""
  );
}

function pickSipPassword(credentials = {}) {
  return (
    credentials.sipPassword ||
    credentials.sipPass ||
    credentials.sipSecret ||
    credentials.sipAuthPass ||
    ""
  );
}

/**
 * ICE URLs must carry their scheme exactly once. Provider defaults store
 * `stun:host`; older code prefixed another `stun:`, producing the invalid
 * `stun:stun:stun.l.google.com` for every branded provider — no STUN, no
 * NAT traversal, one-way audio.
 */
function normalizeIceServer(value, fallbackScheme = "stun") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(stuns?|turns?):/i.test(text)) return text;
  return `${fallbackScheme}:${text}`;
}

function buildIceServers(credentials = {}) {
  if (Array.isArray(credentials.iceServers) && credentials.iceServers.length) {
    return credentials.iceServers;
  }

  const stunUrl =
    normalizeIceServer(credentials.stunServer || credentials.stunUrl, "stun") ||
    "stun:stun.l.google.com:19302";
  const iceServers = [{ urls: stunUrl }];

  const turnUrl = normalizeIceServer(
    credentials.turnServer || credentials.turnUrl,
    "turn"
  );
  if (turnUrl && credentials.turnUsername && credentials.turnPassword) {
    iceServers.push({
      urls: turnUrl,
      username: credentials.turnUsername,
      credential: credentials.turnPassword,
    });
  }

  return iceServers;
}

/** A WebSocket URL the tenant saved, normalised (`https://` → `wss://`). */
function explicitWsUrl(credentials = {}) {
  return normalizeWsUrl(
    credentials.sipWsUrl ||
      credentials.wssUrl ||
      credentials.websocketUrl ||
      credentials.sipWebsocket ||
      ""
  );
}

/**
 * Ask the backend to rank candidate endpoints before probing from the browser.
 *
 * A page cannot do DNS SRV lookups or open raw TCP sockets, so the server adds
 * evidence the softphone could never gather on its own. Best effort on purpose:
 * an offline API or a read-only agent must never block a call.
 */
async function fetchServerDiscovery({ provider, host, providerWsUrl }) {
  const sipHost = String(host || "").trim();
  if (!sipHost) return null;

  try {
    const response = await discoverVoipWebSocket({
      providerId: provider?.id || "",
      host: sipHost,
      providerDomain: providerWebDomain(provider),
      providerWsUrl: providerWsUrl || provider?.defaults?.sipWsUrl || "",
    });
    return response?.data || null;
  } catch {
    return null;
  }
}

function remoteIdentity(session) {
  try {
    const uri = session?.remote_identity?.uri;
    if (!uri) return "";
    const user = uri.user || "";
    const host = uri.host || "";
    if (user && host) return `${user}@${host}`;
    return user || String(uri) || "";
  } catch {
    return "";
  }
}

class VoipService {
  constructor() {
    this.activeConfig = null;
    this.provider = null;
    this.device = null;
    this.call = null;
    this.listeners = new Map();
    this.initialized = false;
    this.registered = false;
    this.acceptInbound = true;
    this.remoteAudioEl = null;
    this.pcConfig = null;
    this.held = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.mixContext = null;
    this.remoteStream = null;
    this.pendingRecordingDataUrl = null;
    this.pendingQuality = null;
    /** Resolution of the SIP WebSocket actually in use (see utils/sipWebSocket). */
    this.wsInfo = null;
    /** Platform gateway from the API (VITE_SIP_DEFAULT_WSS is the fallback). */
    this.platformDefaultWss = "";
  }

  async initialize({ force = false } = {}) {
    if (this.initialized && !force) return this.activeConfig;

    try {
      this.reset();
      const res = await getVoipSettings();
      const settings = res?.data || {};
      const configs = settings.configurations || [];
      const activeId = settings.activeConfigId || "";

      if (!activeId) {
        throw new Error(
          "No active VoIP/SIP provider. Add one in Settings → VoIP/SIP and set it active."
        );
      }

      const activeConfig = configs.find((c) => c.id === activeId);
      if (!activeConfig) {
        throw new Error("Active VoIP configuration not found");
      }

      this.activeConfig = activeConfig;
      this.acceptInbound =
        settings.acceptInbound === undefined
          ? true
          : Boolean(settings.acceptInbound);
      // Server-side gateway wins over the build-time env (it can change without
      // a redeploy), and it is what lets IP-only carriers work out of the box.
      this.platformDefaultWss = settings.platformDefaultWss || "";
      const provider =
        getProviderById(activeConfig.providerId) || {
          id: activeConfig.providerId,
          name: activeConfig.name || activeConfig.providerId,
          defaults: {},
        };
      this.provider = provider;
      const credentials = resolveSipCredentials(
        activeConfig.providerId,
        activeConfig.credentials || {}
      );
      await this.initializeJsSip(credentials);
      this.initialized = true;
      return this.activeConfig;
    } catch (error) {
      console.error("VoIP initialization failed:", error);
      this.reset();
      throw error;
    }
  }

  reset() {
    this.detachRemoteAudio();
    try {
      if (this.device?.stop) this.device.stop();
    } catch {
      /* ignore */
    }
      this.activeConfig = null;
      this.provider = null;
      this.device = null;
      this.call = null;
      this.initialized = false;
      this.registered = false;
      this.acceptInbound = true;
      this.pcConfig = null;
      this.held = false;
      this.mediaRecorder = null;
      this.recordedChunks = [];
      this.mixContext = null;
      this.remoteStream = null;
      this.pendingRecordingDataUrl = null;
      this.pendingQuality = null;
      this.wsInfo = null;
    }

  /**
   * Resolve the WebSocket this provider must be reached on.
   *
   * Precedence lives in `utils/sipWebSocket.js`: a URL the tenant saved always
   * wins, then the provider preset, then the platform gateway, then whatever we
   * learned/discovered earlier, then verified conventional endpoints. Nothing in
   * the discovered layers is used before a real WebSocket handshake succeeds.
   */
  async resolveWebSocket(credentials, { force = false, skipTenant = false } = {}) {
    const host = pickSipHost(credentials);
    const provider = this.provider;
    const explicit = skipTenant ? "" : explicitWsUrl(credentials);
    const providerPreset = provider?.defaults?.sipWsUrl || "";
    const platformDefault = this.platformDefaultWss || SIP_DEFAULT_WSS;

    // Only ask the backend when the browser has nothing else to go on: a saved
    // or operator-supplied URL must not pay for a network round-trip.
    const discovery =
      explicit || providerPreset || platformDefault
        ? null
        : await fetchServerDiscovery({ provider, host, providerWsUrl: providerPreset });

    const resolution = await resolveSipWebSocket({
      credentials,
      provider,
      host,
      platformDefault,
      discovery,
      force,
      skipTenant,
    });

    this.wsInfo = resolution;
    return resolution;
  }

  async buildUaConfiguration(credentials, JsSIP, { force = false, skipTenant = false } = {}) {
    const host = pickSipHost(credentials);
    const user = pickSipUser(credentials);
    const password = pickSipPassword(credentials);

    if (!host || !user || !password) {
      const missing = [];
      if (!host) missing.push("SIP server");
      if (!user) missing.push("username");
      if (!password) missing.push("password");
      throw new Error(
        `Missing ${missing.join(", ")}. Open Settings → VoIP/SIP → Edit and add it, then test again.`
      );
    }

    const { wsUrl, source, warning } = await this.resolveWebSocket(credentials, {
      force,
      skipTenant,
    });
    const socket = new JsSIP.WebSocketInterface(wsUrl);
    const configuration = {
      sockets: [socket],
      uri: `sip:${user}@${host}`,
      password,
      display_name: credentials.displayName || user,
      register: true,
      session_timers: false,
      register_expires: 300,
    };

    const iceServers = buildIceServers(credentials);
    configuration.pcConfig = { iceServers };
    return { configuration, host, user, wsUrl, wsSource: source, wsWarning: warning };
  }

  async initializeJsSip(credentials) {
    const mod = await import("jssip");
    const JsSIP = mod.default || mod;

    /**
     * One registration attempt. `forceWs` re-resolves the WebSocket instead of
     * trusting the cached discovery result.
     */
    const attempt = async ({ forceWs = false, skipTenant = false } = {}) => {
      const { configuration, wsUrl } = await this.buildUaConfiguration(
        credentials,
        JsSIP,
        { force: forceWs, skipTenant }
      );
      this.pcConfig = configuration.pcConfig;

      this.device = new JsSIP.UA(configuration);
      this.setupSipListeners();

      const stopDevice = () => {
        try {
          this.device?.unregister?.();
          this.device?.stop?.();
        } catch {
          /* ignore */
        }
        this.device = null;
        this.registered = false;
      };

      await new Promise((resolve, reject) => {
        const fail = (error) => {
          cleanup();
          stopDevice();
          reject(error instanceof Error ? error : new Error(String(error)));
        };

        const timeout = setTimeout(
          () =>
            fail(
              Object.assign(
                new Error(
                  "SIP registration timed out. Verify the WebSocket (WSS) URL, the server/port, and the username/password."
                ),
                { websocket: true, wsUrl }
              )
            ),
          20000
        );

        const onRegistered = () => {
          cleanup();
          this.registered = true;
          resolve();
        };
        const onFailed = (event) => {
          const reason =
            event?.cause ||
            event?.response?.reason_phrase ||
            "SIP registration failed";
          const isSocketProblem = /websocket|connect/i.test(String(reason));
          fail(
            Object.assign(
              new Error(
                isSocketProblem
                  ? `Cannot open the SIP WebSocket (${wsUrl}). Check the WSS URL, port and firewall.`
                  : String(reason)
              ),
              { websocket: isSocketProblem, wsUrl }
            )
          );
        };
        const cleanup = () => {
          clearTimeout(timeout);
          this.device?.off("registered", onRegistered);
          this.device?.off("registrationFailed", onFailed);
        };

        this.device.on("registered", onRegistered);
        this.device.on("registrationFailed", onFailed);

        try {
          this.device.start();
        } catch (error) {
          fail(error);
        }
      });
    };

    try {
      await attempt();
    } catch (error) {
      // An endpoint can go stale: a learned/discovered URL when the provider
      // moved the WebSocket, or a saved URL that no longer answers. In both
      // cases resolve once more instead of leaving the agent with a dead line —
      // a *working* saved URL is never replaced, only a failing one.
      const info = this.wsInfo || {};
      const rediscoverable =
        ["learned", "discovered", "derived"].includes(info.source) ||
        (info.source === "tenant" && info.verification === "unverified");

      if (!error?.websocket || !rediscoverable) throw error;

      if (info.source !== "tenant") {
        invalidateWsCache(this.provider?.id, pickSipHost(credentials));
      }

      await attempt({
        forceWs: true,
        skipTenant: info.source === "tenant",
      });
    }
  }

  /**
   * Live SIP REGISTER probe (does not replace the active softphone session).
   */
  async testRegistration(credentials, { timeoutMs = 15000, providerId } = {}) {
    const mod = await import("jssip");
    const JsSIP = mod.default || mod;
    const merged = resolveSipCredentials(providerId, credentials || {});

    // Test a provider that is not necessarily the active one, so the resolver
    // must see that provider's catalog preset/domain — and the softphone's own
    // session state must survive the probe untouched.
    const previousProvider = this.provider;
    const previousWsInfo = this.wsInfo;
    if (providerId) {
      this.provider = getProviderById(providerId) || previousProvider;
    }

    let ua = null;

    try {
      const { configuration, host, user, wsUrl, wsSource } =
        await this.buildUaConfiguration(merged, JsSIP);
      ua = new JsSIP.UA(configuration);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(
            new Error(
              "SIP registration timed out. Verify WSS URL, firewall, and credentials."
            )
          );
        }, timeoutMs);

        const onRegistered = () => {
          cleanup();
          resolve();
        };
        const onFailed = (e) => {
          cleanup();
          reject(
            new Error(
              e?.cause || e?.response?.reason_phrase || "SIP registration failed"
            )
          );
        };
        const cleanup = () => {
          clearTimeout(timeout);
          ua.off("registered", onRegistered);
          ua.off("registrationFailed", onFailed);
        };

        ua.on("registered", onRegistered);
        ua.on("registrationFailed", onFailed);
        ua.start();
      });

      return {
        success: true,
        message: wsSource === "tenant"
          ? "Live SIP registration succeeded. Softphone is ready."
          : `Live SIP registration succeeded on the auto-detected WebSocket (${wsUrl}).`,
        details: { host, username: user, wsUrl, wsSource },
      };
    } finally {
      this.provider = previousProvider;
      this.wsInfo = previousWsInfo;
      try {
        ua?.unregister?.();
        ua?.stop?.();
      } catch {
        /* ignore */
      }
    }
  }

  /** Which WebSocket the softphone is registered on — used by settings + logs. */
  getWebSocketInfo() {
    return this.wsInfo ? { ...this.wsInfo } : null;
  }

  setupSipListeners() {
    if (!this.device) return;

    this.device.on("connected", () => this.emit("ready"));
    this.device.on("registered", () => {
      this.registered = true;
      this.emit("registered");
    });
    this.device.on("unregistered", () => {
      this.registered = false;
      this.emit("unregistered");
    });
    this.device.on("registrationFailed", (error) => {
      this.registered = false;
      this.emit("error", new Error(error?.cause || "SIP registration failed"));
    });
    this.device.on("newRTCSession", (data) => {
      if (data.originator !== "remote") return;
      if (!this.acceptInbound) {
        try {
          data.session?.terminate?.({ status_code: 486, reason_phrase: "Busy Here" });
        } catch {
          /* ignore */
        }
        return;
      }
      this.emit("incoming", data.session);
    });
  }

  attachRemoteAudio(session) {
    this.detachRemoteAudio();
    const connection = session?.connection;
    if (!connection) return;

    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.playsInline = true;
    audio.style.display = "none";
    document.body.appendChild(audio);
    this.remoteAudioEl = audio;

    const bindStream = (stream) => {
      if (!stream || !this.remoteAudioEl) return;
      this.remoteStream = stream;
      this.remoteAudioEl.srcObject = stream;
      this.remoteAudioEl.play?.().catch(() => {});
    };

    if (typeof connection.getReceivers === "function") {
      const tracks = connection
        .getReceivers()
        .map((r) => r.track)
        .filter(Boolean);
      if (tracks.length) bindStream(new MediaStream(tracks));
    }

    connection.addEventListener("track", (event) => {
      if (event.streams?.[0]) bindStream(event.streams[0]);
      else if (event.track) bindStream(new MediaStream([event.track]));
    });
    connection.addEventListener("addstream", (event) => {
      bindStream(event.stream);
    });
  }

  detachRemoteAudio() {
    if (this.remoteAudioEl) {
      try {
        this.remoteAudioEl.srcObject = null;
        this.remoteAudioEl.remove();
      } catch {
        /* ignore */
      }
      this.remoteAudioEl = null;
    }
    this.remoteStream = null;
  }

  getLocalStream() {
    const connection = this.call?.connection;
    if (!connection?.getSenders) return null;
    const tracks = connection
      .getSenders()
      .map((s) => s.track)
      .filter((t) => t && t.kind === "audio");
    if (!tracks.length) return null;
    return new MediaStream(tracks);
  }

  getRemoteStream() {
    if (this.remoteStream) return this.remoteStream;
    const connection = this.call?.connection;
    if (!connection?.getReceivers) return null;
    const tracks = connection
      .getReceivers()
      .map((r) => r.track)
      .filter((t) => t && t.kind === "audio");
    if (!tracks.length) return null;
    return new MediaStream(tracks);
  }

  shouldRecord(direction = "OUTBOUND") {
    const creds = this.activeConfig?.credentials || {};
    if (direction === "INBOUND") {
      return creds.recordIncoming !== false;
    }
    return creds.recordOutgoing !== false;
  }

  /**
   * Mix local + remote audio into a single MediaRecorder stream.
   */
  async startRecording() {
    if (this.mediaRecorder) return;
    if (typeof MediaRecorder === "undefined") {
      throw new Error("Call recording is not supported in this browser");
    }

    const local = this.getLocalStream();
    const remote = this.getRemoteStream();
    if (!local && !remote) {
      throw new Error("No audio streams available to record yet");
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.mixContext = new AudioCtx();
    const dest = this.mixContext.createMediaStreamDestination();

    if (local) {
      const src = this.mixContext.createMediaStreamSource(local);
      src.connect(dest);
    }
    if (remote) {
      const src = this.mixContext.createMediaStreamSource(remote);
      src.connect(dest);
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

    this.recordedChunks = [];
    this.mediaRecorder = mimeType
      ? new MediaRecorder(dest.stream, { mimeType })
      : new MediaRecorder(dest.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data?.size) this.recordedChunks.push(event.data);
    };
    this.mediaRecorder.start(1000);
    this.emit("recordingStarted");
  }

  async stopRecording() {
    if (!this.mediaRecorder) return null;

    const recorder = this.mediaRecorder;
    const dataUrl = await new Promise((resolve) => {
      recorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, {
            type: recorder.mimeType || "audio/webm",
          });
          this.recordedChunks = [];
          if (!blob.size) {
            resolve(null);
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result || null);
          reader.readAsDataURL(blob);
        } catch {
          resolve(null);
        }
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });

    this.mediaRecorder = null;
    try {
      await this.mixContext?.close?.();
    } catch {
      /* ignore */
    }
    this.mixContext = null;
    this.emit("recordingStopped");
    return dataUrl;
  }

  setHold(held) {
    if (!this.call) return;
    this.held = Boolean(held);
    try {
      if (this.held) {
        this.call.mute({ audio: true });
        const connection = this.call.connection;
        connection?.getSenders?.().forEach((sender) => {
          if (sender.track?.kind === "audio") sender.track.enabled = false;
        });
      } else {
        this.call.unmute({ audio: true });
        const connection = this.call.connection;
        connection?.getSenders?.().forEach((sender) => {
          if (sender.track?.kind === "audio") sender.track.enabled = true;
        });
      }
    } catch (error) {
      console.error("Hold toggle failed:", error);
    }
    this.emit(this.held ? "held" : "unheld");
  }

  async transfer(to) {
    if (!this.call || !to) {
      throw new Error("Active call and transfer target are required");
    }
    const creds = this.activeConfig?.credentials || {};
    const host = pickSipHost(creds);
    const target = String(to).includes("@") ? `sip:${to}` : `sip:${to}@${host}`;
    if (typeof this.call.refer !== "function") {
      throw new Error("Blind transfer is not supported by this SIP session");
    }
    this.call.refer(target);
    this.emit("transferred", { to: target });
  }

  async collectQualityStats() {
    const connection = this.call?.connection;
    if (!connection?.getStats) {
      return {
        network: "Unknown",
        audioClarity: "Unknown",
        stability: "Unknown",
      };
    }

    try {
      const report = await connection.getStats();
      let packetsLost = 0;
      let packetsReceived = 0;
      let jitter = 0;
      let rtt = 0;
      let samples = 0;

      report.forEach((stat) => {
        if (stat.type === "inbound-rtp" && stat.kind === "audio") {
          packetsLost += Number(stat.packetsLost || 0);
          packetsReceived += Number(stat.packetsReceived || 0);
          if (stat.jitter != null) {
            jitter += Number(stat.jitter);
            samples += 1;
          }
        }
        if (stat.type === "candidate-pair" && stat.state === "succeeded") {
          if (stat.currentRoundTripTime != null) {
            rtt = Number(stat.currentRoundTripTime) * 1000;
          }
        }
        if (stat.type === "remote-inbound-rtp" && stat.roundTripTime != null) {
          rtt = Math.max(rtt, Number(stat.roundTripTime) * 1000);
        }
      });

      const total = packetsLost + packetsReceived;
      const lossPct = total > 0 ? (packetsLost / total) * 100 : 0;
      const jitterMs = samples ? (jitter / samples) * 1000 : 0;

      const network =
        lossPct < 1 && rtt < 150
          ? "Excellent"
          : lossPct < 3 && rtt < 300
            ? "Good"
            : lossPct < 8
              ? "Fair"
              : "Poor";
      const audioClarity =
        jitterMs < 20 ? "Clear" : jitterMs < 40 ? "Good" : "Noisy";
      const stability =
        lossPct < 2 ? "Stable" : lossPct < 6 ? "Mostly stable" : "Unstable";

      return {
        network,
        audioClarity,
        stability,
        packetLoss: `${lossPct.toFixed(1)}%`,
        jitterMs: Math.round(jitterMs),
        rttMs: Math.round(rtt),
      };
    } catch {
      return {
        network: "Unknown",
        audioClarity: "Unknown",
        stability: "Unknown",
      };
    }
  }

  async makeCall(options) {
    if (!this.device || !this.registered) {
      throw new Error("VoIP softphone is not registered. Check your SIP settings.");
    }

    const { to, ticketId, metadata = {} } = options;
    const creds = resolveSipCredentials(
      this.activeConfig?.providerId,
      this.activeConfig?.credentials || {}
    );
    const host = pickSipHost(creds);
    const prefix = String(creds.dialOutPrefix || "").trim();
    let dialTarget = String(to || "").trim();
    // Strip leading + for trunks that want digits only after a dial-out prefix
    if (prefix && !dialTarget.includes("@")) {
      const digits = dialTarget.replace(/^\+/, "");
      dialTarget = `${prefix}${digits}`;
    }
    const target = dialTarget.includes("@")
      ? `sip:${dialTarget}`
      : `sip:${dialTarget}@${host}`;

    const eventHandlers = {
      peerconnection: (e) => {
        const pc = e?.peerconnection || this.call?.connection;
        if (pc && this.call) this.attachRemoteAudio(this.call);
      },
      progress: () => this.emit("ringing"),
      failed: (e) =>
        this.emit("error", new Error(e?.cause || "SIP call failed")),
      ended: async () => {
        if (!this.pendingRecordingDataUrl && this.mediaRecorder) {
          await this.captureCallArtifacts();
        } else if (!this.pendingQuality) {
          try {
            this.pendingQuality = await this.collectQualityStats();
          } catch {
            /* ignore */
          }
        }
        this.detachRemoteAudio();
        this.call = null;
        this.held = false;
        this.emit("ended");
      },
      confirmed: () => {
        this.attachRemoteAudio(this.call);
        this.emit("connected");
      },
    };

    this.call = this.device.call(target, {
      eventHandlers,
      mediaConstraints: { audio: true, video: false },
      pcConfig: this.pcConfig || undefined,
      extraHeaders: ticketId
        ? [`X-Ticket-Id: ${ticketId}`]
        : metadata?.ticketId
          ? [`X-Ticket-Id: ${metadata.ticketId}`]
          : undefined,
    });

    if (this.call?.connection) {
      this.attachRemoteAudio(this.call);
    }

    return this.call;
  }

  async acceptCall(call) {
    if (!call) return;
    this.call = call;
    call.answer({
      mediaConstraints: { audio: true, video: false },
    });
    this.attachRemoteAudio(call);

    call.on("ended", async () => {
      if (!this.pendingRecordingDataUrl && this.mediaRecorder) {
        await this.captureCallArtifacts();
      }
      this.detachRemoteAudio();
      this.call = null;
      this.held = false;
      this.emit("ended");
    });
    call.on("failed", async (e) => {
      await this.captureCallArtifacts();
      this.detachRemoteAudio();
      this.call = null;
      this.held = false;
      this.emit("error", new Error(e?.cause || "Inbound call failed"));
    });
    call.on("confirmed", () => {
      this.attachRemoteAudio(call);
      this.emit("connected");
    });
  }

  async rejectCall(call) {
    if (!call) return;
    try {
      if (typeof call.terminate === "function") {
        call.terminate({ status_code: 486, reason_phrase: "Busy Here" });
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Snapshot recording + quality before tearing down the peer connection.
   */
  async captureCallArtifacts() {
    try {
      this.pendingQuality = await this.collectQualityStats();
    } catch {
      this.pendingQuality = null;
    }
    try {
      this.pendingRecordingDataUrl = await this.stopRecording();
    } catch {
      this.pendingRecordingDataUrl = null;
    }
    return {
      quality: this.pendingQuality,
      recordingDataUrl: this.pendingRecordingDataUrl,
    };
  }

  consumeCallArtifacts() {
    const artifacts = {
      quality: this.pendingQuality,
      recordingDataUrl: this.pendingRecordingDataUrl,
    };
    this.pendingQuality = null;
    this.pendingRecordingDataUrl = null;
    return artifacts;
  }

  async hangup() {
    if (!this.call) return;
    await this.captureCallArtifacts();
    try {
      if (typeof this.call.terminate === "function") {
        this.call.terminate();
      }
    } catch (error) {
      console.error("Failed to hang up:", error);
    }
    this.detachRemoteAudio();
    this.call = null;
    this.held = false;
  }

  toggleMute(muted) {
    if (!this.call || this.held) return;
    try {
      if (muted) this.call.mute({ audio: true });
      else this.call.unmute({ audio: true });
    } catch (error) {
      console.error("Mute toggle failed:", error);
    }
  }

  sendDtmf(digit) {
    if (!this.call?.sendDTMF) return;
    try {
      this.call.sendDTMF(String(digit));
    } catch {
      /* ignore */
    }
  }

  getIncomingCaller(session) {
    return remoteIdentity(session);
  }

  supportsRecording() {
    return typeof MediaRecorder !== "undefined";
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) callbacks.splice(index, 1);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach((callback) => callback(data));
  }

  async destroy() {
    await this.hangup();
    try {
      this.device?.unregister?.();
      this.device?.stop?.();
    } catch {
      /* ignore */
    }
    this.reset();
    this.listeners.clear();
  }
}

const voipService = new VoipService();

export default voipService;
