/**
 * SIP-over-WebSocket auto-resolution.
 *
 * A browser can only speak SIP through a WebSocket: JsSIP cannot open UDP, so a
 * carrier that hands out "IP 46.62.134.9 / port 5060" (Stuncall, most Nigerian
 * SIP trunk resellers) is unreachable until a `wss://` endpoint is known.
 *
 * Rather than asking the agent to type that URL we resolve it in layers, best
 * first, and only fall through to the next layer when the previous one cannot
 * be used:
 *
 *   1. tenant       — a URL the agent/admin pasted. Always wins, even when the
 *                     probe below is inconclusive: a human decision is final.
 *   2. provider     — baked-in catalog default (voipProviders.js).
 *   3. platform     — the operator's own WebRTC gateway (VITE_SIP_DEFAULT_WSS).
 *   4. learned      — a URL discovered earlier and proven to open (cache).
 *   5. discovered   — candidates ranked by the backend probe (DNS SRV + common
 *                     Asterisk/FreeSWITCH/Kamailio ports and paths).
 *   6. derived      — conventional endpoints derived from the SIP host/domain.
 *
 * Layers 5 and 6 are *verified* with a real `new WebSocket()` handshake before
 * they are handed to JsSIP, so a guess can never replace a working endpoint.
 */

import { isRawHostEndpoint, wssFor } from "../constants/voipProviders.js";

const CACHE_PREFIX = "hcp.sipws.";
const POSITIVE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 10 * 60 * 1000;
/** A URL proven this recently is reused without another handshake. */
const TRUSTED_CACHE_MS = 5 * 60 * 1000;
const DEFAULT_PROBE_TIMEOUT_MS = 3500;
const DEFAULT_PROBE_BUDGET_MS = 9000;
const DEFAULT_PROBE_CONCURRENCY = 6;

/** In-memory mirror of the localStorage cache (avoids a parse per call). */
const memoryCache = new Map();

function now() {
  return Date.now();
}

function isSecurePage() {
  return (
    typeof window !== "undefined" &&
    String(window.location?.protocol || "").toLowerCase() === "https:"
  );
}

function isLoopback(url) {
  return /^wss?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i.test(
    String(url || "")
  );
}

/**
 * Browsers block `ws://` from an https page (mixed content). Only allow it on
 * an http page (local Vite dev) or against the loopback interface.
 */
function isSchemeAllowed(url) {
  if (!/^wss?:\/\//i.test(String(url || ""))) return false;
  if (/^wss:/i.test(url)) return true;
  return !isSecurePage() || isLoopback(url);
}

/** Split `user@host:port;transport=ws` into `{ host, port }`. */
export function splitHostPort(value) {
  const raw = String(value || "").trim();
  if (!raw) return { host: "", port: "" };

  const withoutScheme = raw
    .replace(/^sips?:/i, "")
    .replace(/^\/\//, "")
    .replace(/;[^;]*$/, "");

  const withoutUser = withoutScheme.includes("@")
    ? withoutScheme.split("@").pop()
    : withoutScheme;

  // [2606:4700::1111]:5060
  const v6 = withoutUser.match(/^\[([0-9a-f:]+)\](?::(\d+))?$/i);
  if (v6) return { host: v6[1], port: v6[2] || "" };

  const v4 = withoutUser.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/);
  if (v4) return { host: v4[1], port: v4[2] || "" };

  const generic = withoutUser.match(/^([^:/\s]+)(?::(\d+))?/);
  if (generic) return { host: generic[1], port: generic[2] || "" };

  return { host: withoutUser, port: "" };
}

/**
 * Normalise anything an operator may paste into a WebSocket URL.
 * `https://host/ws`, `host:8089/ws`, `wss://host/ws/` all become a valid
 * `wss://` endpoint. Returns "" when the value cannot be a WebSocket URL.
 */
export function normalizeWsUrl(value) {
  const text = String(value || "")
    .trim()
    .replace(/^["'<]+|["'>]+$/g, "");
  if (!text) return "";

  // A plain SIP URI is not a WebSocket URL (unless it is explicitly WS).
  if (/^sips?:/i.test(text) && !/;transport=ws/i.test(text)) return "";

  let candidate = text.replace(/\s+/g, "");

  if (/^https?:\/\//i.test(candidate)) {
    candidate = candidate.replace(/^http/i, "ws");
  } else if (/^wss?:\/\//i.test(candidate)) {
    // already a WebSocket URL
  } else if (/^\/\//.test(candidate)) {
    candidate = `wss:${candidate}`;
  } else {
    candidate = `wss://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (!url.hostname) return "";
    return url.href;
  } catch {
    return "";
  }
}

/** Registrable brand domain behind a provider entry (`sip.acme.com` → `acme.com`). */
export function providerWebDomain(provider) {
  if (!provider) return "";
  const candidates = [provider.logoDomain, provider.website];
  for (const value of candidates) {
    const text = String(value || "").trim();
    if (!text) continue;
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      const host = url.hostname.replace(/^www\./i, "");
      if (host && host.includes(".") && !isRawHostEndpoint(host)) return host;
    } catch {
      /* keep looking */
    }
  }
  return "";
}

/**
 * Endpoint shapes used by the stacks carriers actually deploy:
 *   FreeSWITCH  → 8089 `/ws` (TLS) or 8088 `/ws` (plain)
 *   Asterisk    → 8088 `/ws` plain, 8089 TLS (chan_pjsip transport-ws)
 *   Kamailio    → 443 / 7443 `/ws` behind nginx
 *   Janus/other → `/websocket`, `/sip`
 */
function conventionalUrlsFor(host) {
  if (!host) return [];
  // A bare IP cannot present a publicly trusted certificate, so a `wss://`
  // guess against it is guaranteed to be rejected by the browser.
  if (isRawHostEndpoint(host)) return [];

  return [
    `wss://${host}:8089/ws`,
    `wss://${host}:7443/ws`,
    `wss://${host}/ws`,
    `wss://${host}:7443`,
    `wss://${host}:8089`,
  ];
}

/**
 * A carrier who only published an IP may still run its WebRTC endpoint on a
 * hostname (`sip.<brand>`), which is the single most likely place a WebSocket
 * lives. Guessing those is cheap because every candidate is verified first.
 */
function brandDomainUrls(domain, sipHost) {
  if (!domain) return [];
  const hosts = [
    `sip.${domain}`,
    `voip.${domain}`,
    `wss.${domain}`,
    `pbx.${domain}`,
    domain,
  ].filter(
    (entry) => entry.toLowerCase() !== String(sipHost || "").toLowerCase()
  );

  const urls = [];
  for (const host of hosts) {
    urls.push(
      `wss://${host}:8089/ws`,
      `wss://${host}:7443/ws`,
      `wss://${host}/ws`
    );
  }
  return urls;
}

/**
 * Ordered candidates, highest confidence first. Duplicates are removed so the
 * probe never opens the same socket twice.
 */
export function buildWsCandidates({
  credentials = {},
  provider = null,
  platformDefault = "",
  discovered = [],
  host = "",
  domain = "",
  skipTenant = false,
} = {}) {
  const list = [];
  const push = (value, source, detail = "") => {
    const url = normalizeWsUrl(value);
    if (!url || !isSchemeAllowed(url)) return;
    if (list.some((entry) => entry.url.toLowerCase() === url.toLowerCase())) {
      return;
    }
    list.push({ url, source, detail });
  };

  // 1. Something the tenant typed — always honoured, never overridden.
  //    `skipTenant` is only used when that URL already failed a live
  //    registration, so the next layer gets a chance instead of a dead line.
  if (!skipTenant) {
    push(
      credentials.sipWsUrl ||
        credentials.wssUrl ||
        credentials.websocketUrl ||
        credentials.sipWebsocket,
      "tenant",
      "Saved in this workspace"
    );
  }

  // 2. Provider catalog preset.
  push(
    provider?.defaults?.sipWsUrl,
    "provider",
    `${provider?.name || "Provider"} preset`
  );

  // 3. Operator gateway (one value that works for every tenant).
  push(platformDefault, "platform", "Platform WebRTC gateway");

  // 4. Backend probe results, already ranked by confidence.
  for (const entry of Array.isArray(discovered) ? discovered : []) {
    const url = typeof entry === "string" ? entry : entry?.url;
    const detail =
      typeof entry === "string" ? "" : entry?.detail || entry?.reason || "";
    push(url, "discovered", detail);
  }

  const { host: sipHost } = splitHostPort(
    host || credentials.sipServer || credentials.sipHost || ""
  );
  const webDomain = domain || providerWebDomain(provider);

  // 5. Conventional endpoints on the SIP host, then on the brand's hostnames.
  for (const url of conventionalUrlsFor(sipHost)) {
    push(url, "derived", `Conventional endpoint on ${sipHost}`);
  }
  for (const url of brandDomainUrls(webDomain, sipHost)) {
    push(url, "derived", "Conventional endpoint on the provider's domain");
  }

  // 6. Last resort for hostname-based trunks: the historic default.
  if (sipHost && !isRawHostEndpoint(sipHost)) {
    push(wssFor(sipHost), "derived", "Default Asterisk/FreeSWITCH WebSocket");
  }

  return list;
}


function cacheKey(providerId, sipHost) {
  return `${CACHE_PREFIX}${String(providerId || "custom").toLowerCase()}|${String(
    sipHost || ""
  ).toLowerCase()}`;
}

function readCache(key) {
  const ttlOf = (entry) => (entry?.ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS);

  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key);
    if (now() - entry.at < ttlOf(entry)) return entry;
    memoryCache.delete(key);
  }

  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;
    const entry = JSON.parse(stored);
    if (!entry?.at || now() - entry.at >= ttlOf(entry)) {
      window.localStorage.removeItem(key);
      return null;
    }
    memoryCache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

function writeCache(key, entry) {
  memoryCache.set(key, entry);
  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* private mode / quota — the in-memory copy still helps this session */
  }
}

/** Forget what we learned about a provider's WebSocket (used after a failure). */
export function invalidateWsCache(providerId, host) {
  const { host: sipHost } = splitHostPort(host);
  const key = cacheKey(providerId, sipHost);
  memoryCache.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Open a real WebSocket and report whether the handshake completed. This is the
 * exact operation JsSIP performs, so a success here is a success for the
 * softphone (certificate, proxy and firewall included).
 */
export function probeWebSocket(
  url,
  { timeoutMs = DEFAULT_PROBE_TIMEOUT_MS } = {}
) {
  return new Promise((resolve) => {
    const startedAt = now();
    let socket = null;
    let settled = false;

    const finish = (ok, detail) => {
      if (settled) return;
      settled = true;
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
      resolve({ ok, url, detail, latencyMs: now() - startedAt });
    };

    if (
      typeof window === "undefined" ||
      typeof window.WebSocket !== "function"
    ) {
      resolve({
        ok: false,
        url,
        detail: "WebSocket is not available",
        latencyMs: 0,
      });
      return;
    }

    try {
      socket = new window.WebSocket(url);
    } catch (error) {
      resolve({
        ok: false,
        url,
        detail: error?.message || "Invalid WebSocket URL",
        latencyMs: now() - startedAt,
      });
      return;
    }

    const timer = setTimeout(() => finish(false, "timed out"), timeoutMs);
    socket.onopen = () => {
      clearTimeout(timer);
      finish(true, "open");
    };
    socket.onerror = () => {
      clearTimeout(timer);
      finish(false, "handshake failed");
    };
    socket.onclose = (event) => {
      clearTimeout(timer);
      finish(false, `closed (${event?.code ?? "?"})`);
    };
  });
}



/**
 * Probe candidates in priority order with bounded parallelism: workers pull the
 * next candidate from the queue, so earlier (higher-confidence) endpoints start
 * first and the first success wins immediately.
 */
export function probeFirstReachable(
  candidates = [],
  {
    timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
    budgetMs = DEFAULT_PROBE_BUDGET_MS,
    concurrency = DEFAULT_PROBE_CONCURRENCY,
  } = {}
) {
  return new Promise((resolve, reject) => {
    const attempts = [];
    let cursor = 0;
    let active = 0;
    let settled = false;

    if (!candidates.length) {
      reject(
        Object.assign(new Error("No WebSocket endpoints to try"), {
          code: "SIP_WS_NO_CANDIDATES",
          attempts,
        })
      );
      return;
    }

    const budgetTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        Object.assign(new Error("WebSocket discovery timed out"), {
          code: "SIP_WS_TIMEOUT",
          attempts,
        })
      );
    }, budgetMs);

    const finish = (payload, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(budgetTimer);
      if (error) reject(error);
      else resolve(payload);
    };

    const pump = () => {
      if (settled) return;

      if (cursor >= candidates.length && active === 0) {
        finish(
          null,
          Object.assign(new Error("No reachable WebSocket endpoint"), {
            code: "SIP_WS_UNREACHABLE",
            attempts,
          })
        );
        return;
      }

      while (active < concurrency && cursor < candidates.length) {
        const candidate = candidates[cursor];
        cursor += 1;
        active += 1;

        probeWebSocket(candidate.url, { timeoutMs })
          .then((result) => {
            attempts.push({
              ...result,
              source: candidate.source,
              detail: candidate.detail || result.detail,
            });
            if (result.ok && !settled) {
              finish({
                ...candidate,
                verification: "open",
                attempts,
                latencyMs: result.latencyMs,
              });
            }
          })
          .catch((error) => {
            attempts.push({
              url: candidate.url,
              ok: false,
              detail: error?.message || "probe failed",
              source: candidate.source,
            });
          })
          .finally(() => {
            active -= 1;
            pump();
          });
      }
    };

    pump();
  });
}

/**
 * Resolve the WebSocket URL for a softphone session.
 *
 * `discovery` is the optional backend ranking (`{ candidates: [...] }`); it is
 * only consulted after the explicit/provider/platform layers, and every entry
 * is still verified locally before use.
 *
 * @returns {Promise<{wsUrl:string, source:string, verification:string, warning:string, attempts:Array}>}
 */
export async function resolveSipWebSocket({
  credentials = {},
  provider = null,
  host = "",
  platformDefault = "",
  discovery = null,
  verify = true,
  force = false,
  skipTenant = false,
} = {}) {
  const { host: sipHost } = splitHostPort(
    host || credentials.sipServer || credentials.sipHost || ""
  );
  const providerId = provider?.id || credentials.providerId;
  const domain = providerWebDomain(provider);
  const key = cacheKey(providerId, sipHost);

  const candidates = buildWsCandidates({
    credentials,
    provider,
    platformDefault,
    discovered: discovery?.candidates || discovery?.urls || [],
    host: sipHost,
    domain,
    skipTenant,
  });

  // 1. Explicit tenant URL — a human decision is final, even when our probe
  //    cannot reach it (their browser may sit behind a different network).
  const explicit = candidates.find((entry) => entry.source === "tenant");
  if (explicit) {
    const probe = verify ? await probeWebSocket(explicit.url) : { ok: true };
    return {
      wsUrl: explicit.url,
      source: "tenant",
      verification: probe.ok ? "open" : "unverified",
      warning: probe.ok ? "" : probe.detail || "",
      attempts: [probe],
    };
  }

  // 2. Provider preset, then the platform gateway: both operator decisions.
  const preset = candidates.find(
    (entry) => entry.source === "provider" || entry.source === "platform"
  );
  if (preset) {
    return {
      wsUrl: preset.url,
      source: preset.source,
      verification: "trusted",
      warning: "",
      attempts: [],
    };
  }

  // 3. Anything learned on this device for this provider + host.
  if (!force) {
    const cached = readCache(key);

    if (cached?.ok && cached.url) {
      // Reuse without a handshake when it was proven moments ago (the softphone
      // initialises on every call — a repeated probe would add latency for
      // nothing), otherwise re-verify so a moved endpoint is caught.
      const fresh = now() - cached.at < TRUSTED_CACHE_MS;
      const probe = verify && !fresh ? await probeWebSocket(cached.url) : { ok: true };
      if (probe.ok) {
        return {
          wsUrl: cached.url,
          source: "learned",
          verification: fresh ? "trusted" : "open",
          warning: "",
          attempts: fresh ? [] : [probe],
        };
      }
      invalidateWsCache(providerId, sipHost);
    }

    if (cached && !cached.ok && now() - cached.at < NEGATIVE_TTL_MS) {
      throw Object.assign(
        new Error(
          cached.message ||
            `No WebSocket endpoint answered for ${sipHost || "this provider"}.`
        ),
        {
          code: "SIP_WS_UNREACHABLE",
          attempts: cached.attempts || [],
          cached: true,
        }
      );
    }
  }

  // 4. Probe the discovered + derived ladder.
  const ladder = candidates.filter(
    (entry) => entry.source === "discovered" || entry.source === "derived"
  );

  try {
    const found = await probeFirstReachable(ladder);
    writeCache(key, { ok: true, url: found.url, at: now(), source: found.source });
    return {
      wsUrl: found.url,
      source: found.source,
      verification: "open",
      warning: `${found.detail ? `${found.detail} — ` : ""}detected automatically`,
      attempts: found.attempts,
    };
  } catch (error) {
    const hint = sipHost ? ` for “${sipHost}”` : "";
    const tried = error?.attempts?.length || 0;
    const message =
      candidates.length === 0
        ? `Browser calling needs a WebSocket (WSS) endpoint and none is known${hint}. Paste it once under Settings → VoIP/SIP → Edit → Advanced SIP settings and every agent inherits it.`
        : `No WebSocket endpoint answered${hint} (tried ${tried}). Ask the provider for their WSS URL once — it is reused for every agent automatically afterwards.`;

    writeCache(key, {
      ok: false,
      at: now(),
      message,
      attempts: error?.attempts || [],
    });

    throw Object.assign(new Error(message), {
      code: "SIP_WS_UNREACHABLE",
      attempts: error?.attempts || [],
    });
  }
}

/** Human-readable diagnostics for the settings UI. */
export function describeWsAttempts(attempts = []) {
  return (Array.isArray(attempts) ? attempts : []).map((entry) => ({
    url: entry.url,
    ok: Boolean(entry.ok),
    detail: entry.detail || "",
    source: entry.source || "",
  }));
}

