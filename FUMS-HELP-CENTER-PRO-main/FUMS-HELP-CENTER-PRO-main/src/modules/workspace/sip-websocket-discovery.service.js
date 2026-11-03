import crypto from "crypto";
import dns from "dns/promises";
import net from "net";
import tls from "tls";

/**
 * Server-side SIP-over-WebSocket discovery.
 *
 * A browser softphone (JsSIP) can only reach a provider through `wss://`, while
 * most SIP trunk resellers — Stuncall being the reference case — publish only
 * "IP: 46.62.134.9 / port: 5060". A page cannot probe that: it has no DNS SRV
 * lookups and no raw TCP sockets.
 *
 * This module answers one question as precisely as the network allows:
 * "which WebSocket endpoint of this provider will a browser actually open?"
 *
 * For every candidate it performs the same three steps a browser would:
 *   1. TCP connect,
 *   2. TLS handshake with SNI (certificate must be browser-trusted),
 *   3. `GET /ws` with `Upgrade: websocket` and require `101 Switching Protocols`.
 *
 * Candidates ranked `browserUsable` therefore work in the softphone, not merely
 * somewhere on the network. Results are cached briefly, because the answer for a
 * carrier host changes rarely and discovery costs a few hundred milliseconds.
 */

const DISCOVERY_TTL_MS = 10 * 60 * 1000;
const FAILURE_TTL_MS = 3 * 60 * 1000;
const CONNECT_TIMEOUT_MS = 2000;
const HANDSHAKE_TIMEOUT_MS = 3500;
/** Hard wall-clock budget: the API must answer before the softphone gives up. */
const DISCOVERY_BUDGET_MS = 9000;
const MAX_CONCURRENCY = 8;
const MAX_CANDIDATES = 20;

/** Network-level failures need no second opinion from a TCP probe. */
const HARD_NETWORK_ERRORS = new Set([
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ENOTFOUND",
    "EAI_AGAIN",
    "EAI_NONAME"
]);

/** url -> { entry, expiresAt } */
const probeCache = new Map();

function isIpLiteral(host = "") {
    const value = String(host || "").trim();
    if (!value) return false;
    if (net.isIP(value)) return true;
    return /^\[?[0-9a-f:]+\]?$/i.test(value) && value.includes(":");
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

    const bracketed = withoutUser.match(/^\[([0-9a-f:]+)\](?::(\d+))?$/i);
    if (bracketed) return { host: bracketed[1], port: bracketed[2] || "" };

    const v4 = withoutUser.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/);
    if (v4) return { host: v4[1], port: v4[2] || "" };

    const generic = withoutUser.match(/^([^:/\s]+)(?::(\d+))?/);
    if (generic) return { host: generic[1], port: generic[2] || "" };

    return { host: withoutUser, port: "" };
}

/** Accept `host/ws`, `https://host/ws`, `wss://host/ws` and return a valid wss URL. */
export function normalizeWsUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
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
        return url.hostname ? url.href : "";
    } catch {
        return "";
    }
}

/** Brand domain of the provider (`sip.stuncall.com` → `stuncall.com`). */
function brandDomain(providerDomain = "", sipHost = "") {
    const explicit = String(providerDomain || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .replace(/\/.*$/, "");
    if (explicit && explicit.includes(".") && !isIpLiteral(explicit)) {
        return explicit;
    }

    const host = String(sipHost || "").toLowerCase();
    if (!host || isIpLiteral(host) || !host.includes(".")) return "";
    // sip.acme.com → acme.com (keep registrable-ish two-label suffix).
    const parts = host.split(".");
    if (parts.length <= 2) return host;
    return parts.slice(-2).join(".");
}


/**
 * Endpoint shapes deployed by the stacks carriers actually run:
 *   FreeSWITCH → 8089 `/ws` (TLS), 8088 `/ws` (plain, not browser-usable)
 *   Asterisk   → 8089 TLS via chan_pjsip `transport-ws`
 *   Kamailio   → 443 / 7443 `/ws` behind nginx
 */
function conventionalUrls(host) {
    if (!host || isIpLiteral(host)) return [];
    return [
        `wss://${host}:8089/ws`,
        `wss://${host}:7443/ws`,
        `wss://${host}/ws`,
        `wss://${host}:7443`,
        `wss://${host}:8089`,
    ];
}

/** Hostnames a carrier is likely to serve its WebRTC gateway from. */
function brandDomainUrls(domain, sipHost) {
    if (!domain) return [];
    const hosts = [`sip.${domain}`, `voip.${domain}`, `wss.${domain}`, `pbx.${domain}`, domain]
        .filter((host) => host.toLowerCase() !== String(sipHost || "").toLowerCase());

    const urls = [];
    for (const host of hosts) {
        urls.push(`wss://${host}:8089/ws`, `wss://${host}:7443/ws`, `wss://${host}/ws`);
    }
    return urls;
}

/**
 * `_wss._tcp` / `_sips._tcp` SRV records: the standards-compliant way a carrier
 * advertises a TLS signalling endpoint. Almost nobody publishes `_wss._tcp`,
 * but when they do it is the single most reliable hint available.
 */
async function srvUrls(domain) {
    if (!domain) return [];
    const urls = [];

    const lookups = [
        { name: `_wss._tcp.${domain}`, scheme: "wss" },
        { name: `_sips._tcp.${domain}`, scheme: "wss" },
        { name: `_sip._tls.${domain}`, scheme: "wss" },
    ];

    await Promise.all(
        lookups.map(async ({ name, scheme }) => {
            try {
                const records = await dns.resolveSrv(name);
                for (const record of records.slice(0, 3)) {
                    if (!record?.name) continue;
                    const host = String(record.name).replace(/\.$/, "");
                    const port = Number(record.port) || 443;
                    urls.push(`${scheme}://${host}:${port}/ws`);
                    if (port === 443) urls.push(`${scheme}://${host}/ws`);
                }
            } catch {
                // NXDOMAIN / no SRV is the normal case.
            }
        })
    );

    return urls;
}

/** Plain TCP reachability — used to separate "port closed" from "bad TLS". */
function tcpReachable(host, port, timeoutMs = CONNECT_TIMEOUT_MS) {
    return new Promise((resolve) => {
        let settled = false;
        const socket = net.connect({ host, port });

        const finish = (ok) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(ok);
        };

        socket.setTimeout(timeoutMs);
        socket.once("connect", () => finish(true));
        socket.once("timeout", () => finish(false));
        socket.once("error", () => finish(false));
    });
}

/**
 * TLS handshake + HTTP Upgrade. Resolves as soon as the response status line
 * arrives: `101` means a real WebSocket, `404`/`400` means TLS works but the
 * path is wrong (still useful: it tells us the host is alive).
 */
function websocketHandshake(url, { rejectUnauthorized = true } = {}) {
    const parsed = new URL(url);
    const port = Number(parsed.port) || 443;
    const hostname = parsed.hostname;
    const path = `${parsed.pathname || "/"}${parsed.search || ""}`;

    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        let settled = false;

        const socket = tls.connect({
            host: hostname,
            port,
            servername: isIpLiteral(hostname) ? undefined : hostname,
            rejectUnauthorized,
            ALPNProtocols: ["http/1.1"],
        });

        const fail = (error) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            reject(error);
        };

        const succeed = (payload) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve({ ...payload, latencyMs: Date.now() - startedAt, certValid: socket.authorized === true });
        };

        socket.setTimeout(HANDSHAKE_TIMEOUT_MS, () =>
            fail(Object.assign(new Error("handshake timeout"), { code: "ETIMEDOUT" }))
        );
        socket.once("error", fail);

        socket.once("secureConnect", () => {
            const key = crypto.randomBytes(16).toString("base64");
            const hostHeader = port === 443 ? hostname : `${hostname}:${port}`;
            socket.write(
                [
                    `GET ${path} HTTP/1.1`,
                    `Host: ${hostHeader}`,
                    "Upgrade: websocket",
                    "Connection: Upgrade",
                    `Sec-WebSocket-Key: ${key}`,
                    "Sec-WebSocket-Version: 13",
                    "User-Agent: HelpCentrePro-WSS-Discovery",
                    "",
                    ""
                ].join("\r\n")
            );
        });

        let buffer = "";
        socket.on("data", (chunk) => {
            buffer += chunk.toString("utf8");
            const statusLine = buffer.split("\r\n")[0] || "";
            const match = statusLine.match(/^HTTP\/1\.[01]\s+(\d{3})/);
            if (!match) return;
            const status = Number(match[1]);
            succeed({ upgraded: status === 101, status });
        });
    });
}

/**
 * Full probe of one candidate: verified TLS, then a real Upgrade handshake.
 * A certificate that a browser would reject is reported as `certValid: false`
 * instead of being thrown away — it still tells us the endpoint exists.
 */
async function probeCandidate(url) {
    const parsed = new URL(url);
    const port = Number(parsed.port) || 443;

    try {
        const strict = await websocketHandshake(url, { rejectUnauthorized: true });
        return {
            url,
            port,
            reachable: true,
            tls: true,
            certValid: true,
            upgraded: strict.upgraded,
            status: strict.status,
            latencyMs: strict.latencyMs,
            browserUsable: strict.upgraded,
            error: ""
        };
    } catch (strictError) {
        try {
            const loose = await websocketHandshake(url, { rejectUnauthorized: false });
            return {
                url,
                port,
                reachable: true,
                tls: true,
                certValid: false,
                upgraded: loose.upgraded,
                status: loose.status,
                latencyMs: loose.latencyMs,
                // Upgrade works but the browser will refuse the certificate.
                browserUsable: false,
                error: strictError?.code || strictError?.message || "certificate rejected"
            };
        } catch (looseError) {
            const code = looseError?.code || "";
            // A refused/timed-out port has nothing more to tell us; only probe
            // the raw socket when TLS itself was the problem (a plain-TCP
            // listener on a wss port answers then resets).
            if (HARD_NETWORK_ERRORS.has(code)) {
                return {
                    url,
                    port,
                    reachable: false,
                    tls: false,
                    certValid: false,
                    upgraded: false,
                    status: 0,
                    latencyMs: 0,
                    browserUsable: false,
                    error: code
                };
            }

            const reachable = await tcpReachable(parsed.hostname, port);
            return {
                url,
                port,
                reachable,
                tls: false,
                certValid: false,
                upgraded: false,
                status: 0,
                latencyMs: 0,
                browserUsable: false,
                error: looseError?.code || looseError?.message || "unreachable"
            };
        }
    }
}

/** Confidence score — only `100` is guaranteed to work in a browser. */
function scoreOf(result = {}) {
    if (result.upgraded && result.certValid) return 100;
    if (result.upgraded) return 45;
    if (result.reachable && result.tls) return 20;
    if (result.reachable) return 5;
    return 0;
}


/** Bounded-parallel `map` so discovery never opens 30 sockets at once. */
async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;

    const runners = Array.from(
        { length: Math.min(Math.max(limit, 1), Math.max(items.length, 1)) },
        async () => {
            while (cursor < items.length) {
                const index = cursor;
                cursor += 1;
                results[index] = await worker(items[index], index);
            }
        }
    );

    await Promise.all(runners);
    return results;
}

/**
 * Ordered, de-duplicated list of URLs worth probing for this provider.
 * Explicit hints come first so a supplied URL is always verified and reported.
 */
export function candidateUrls({
    sipHost = "",
    providerDomain = "",
    extraUrls = []
} = {}) {
    const urls = [];
    const seen = new Set();

    const push = (value) => {
        const url = normalizeWsUrl(value);
        if (!url) return;
        const key = url.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        urls.push(url);
    };

    for (const value of Array.isArray(extraUrls) ? extraUrls : []) push(value);

    const domain = brandDomain(providerDomain, sipHost);
    for (const url of conventionalUrls(sipHost)) push(url);
    for (const url of brandDomainUrls(domain, sipHost)) push(url);

    return { urls: urls.slice(0, MAX_CANDIDATES), domain };
}



/**
 * Discover the WebSocket endpoint a browser can use for this provider.
 *
 * Never throws for network reasons: an empty `best` plus populated `candidates`
 * is a valid, actionable answer ("nothing is listening — ask the provider").
 *
 * @returns {Promise<{
 *   providerId: string, host: string, domain: string, checkedAt: string,
 *   cached: boolean, best: object|null, candidates: object[],
 *   network: { addresses: string[] }, notes: string[]
 * }>}
 */
export async function discoverSipWebSocket({
    providerId = "",
    sipHost = "",
    providerDomain = "",
    extraUrls = [],
    force = false
} = {}) {
    const { host: hostOnly } = splitHostPort(sipHost);
    const { urls, domain } = candidateUrls({
        sipHost: hostOnly,
        providerDomain,
        extraUrls
    });

    const cacheKey = `${String(providerId || "custom").toLowerCase()}|${hostOnly.toLowerCase()}|${domain}`;
    const cached = probeCache.get(cacheKey);
    if (!force && cached && cached.expiresAt > Date.now()) {
        return { ...cached.result, cached: true };
    }

    const notes = [];

    // Standards-based hint: SRV records may advertise the exact host/port.
    const srv = await srvUrls(domain);
    // Hints the caller already trusts (saved URL, platform gateway, SRV records)
    // are probed in their own first pass. If one of them works there is nothing
    // left to discover and the answer is immediate.
    const priorityUrls = [
        ...new Set([...srv.map(normalizeWsUrl).filter(Boolean), ...(Array.isArray(extraUrls) ? extraUrls.map(normalizeWsUrl) : [])])
    ].filter(Boolean);

    const allUrls = [...new Set([...priorityUrls, ...urls])].slice(0, MAX_CANDIDATES);
    const restUrls = allUrls.filter((url) => !priorityUrls.includes(url));

    if (srv.length) notes.push(`DNS SRV advertises ${srv.length} TLS endpoint(s).`);

    const network = { addresses: [] };
    if (hostOnly) {
        try {
            const lookups = await dns.lookup(hostOnly, { all: true });
            network.addresses = lookups.map((entry) => entry.address).slice(0, 4);
        } catch {
            notes.push(`DNS lookup for “${hostOnly}” failed — the host may be IP-only.`);
        }
    }

    if (!allUrls.length) {
        notes.push(
            "No WebSocket endpoint can be derived: the provider gave a raw IP and published no hostname. Set SIP_DEFAULT_WSS (platform gateway) or paste the provider's WSS URL."
        );
    } else if (isIpLiteral(hostOnly)) {
        notes.push(
            `“${hostOnly}” is a raw IP, so only hostname-based endpoints are probed — a browser refuses certificates issued for IP literals.`
        );
    }

    const deadline = Date.now() + DISCOVERY_BUDGET_MS;

    const probeGroup = (group) =>
        group.length
            ? mapWithConcurrency(group, MAX_CONCURRENCY, async (url) => {
                  // Never keep an agent waiting on a dead endpoint: once the
                  // budget is spent the remaining candidates are skipped.
                  if (Date.now() > deadline) {
                      return {
                          url,
                          port: 0,
                          reachable: false,
                          tls: false,
                          certValid: false,
                          upgraded: false,
                          status: 0,
                          latencyMs: 0,
                          browserUsable: false,
                          error: "skipped (time budget)"
                      };
                  }

                  try {
                      return await probeCandidate(url);
                  } catch (error) {
                      return {
                          url,
                          port: 0,
                          reachable: false,
                          tls: false,
                          certValid: false,
                          upgraded: false,
                          status: 0,
                          latencyMs: 0,
                          browserUsable: false,
                          error: error?.message || "probe failed"
                      };
                  }
              })
            : [];

    let results = await probeGroup(priorityUrls);

    if (!results.some((entry) => entry.browserUsable)) {
        results = results.concat(await probeGroup(restUrls));
    }

    const ranked = results
        .map((entry) => ({ ...entry, score: scoreOf(entry) }))
        .sort((a, b) => b.score - a.score || a.latencyMs - b.latencyMs);

    const best = ranked.find((entry) => entry.browserUsable) || null;

    if (!best && ranked.some((entry) => entry.upgraded && !entry.certValid)) {
        notes.push(
            "A WebSocket answered but its certificate is not publicly trusted, so browsers reject it. Install a valid certificate for that hostname."
        );
    }
    if (!best && ranked.some((entry) => entry.reachable && !entry.upgraded)) {
        notes.push(
            "TLS answered but no WebSocket upgrade succeeded on the probed paths — the provider may use a different path or port."
        );
    }

    const result = {
        providerId,
        host: hostOnly,
        domain,
        checkedAt: new Date().toISOString(),
        cached: false,
        best: best
            ? { url: best.url, score: best.score, latencyMs: best.latencyMs }
            : null,
        candidates: ranked.slice(0, 8).map((entry) => ({
            url: entry.url,
            score: entry.score,
            browserUsable: entry.browserUsable,
            upgraded: entry.upgraded,
            certValid: entry.certValid,
            reachable: entry.reachable,
            status: entry.status,
            latencyMs: entry.latencyMs,
            detail: entry.browserUsable
                ? "WebSocket upgrade confirmed with a browser-trusted certificate"
                : entry.upgraded
                  ? "WebSocket upgrade confirmed, certificate not browser-trusted"
                  : entry.error || "no WebSocket upgrade"
        })),
        network,
        notes
    };

    probeCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + (best ? DISCOVERY_TTL_MS : FAILURE_TTL_MS)
    });

    return result;
}

/** Test-only helper: drop memoised discovery results. */
export function clearDiscoveryCache() {
    probeCache.clear();
}

export default { discoverSipWebSocket, candidateUrls, clearDiscoveryCache };
