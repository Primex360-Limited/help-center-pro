import { useMemo, useState } from "react";

const BRAND_TONES = [
  "#1570ef",
  "#7a5af8",
  "#ee46bc",
  "#ef6820",
  "#12b76a",
  "#0ba5ec",
  "#f04438",
  "#6927da",
];

function domainFromWebsite(website = "") {
  try {
    const url = new URL(
      /^https?:\/\//i.test(website) ? website : `https://${website}`
    );
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function cleanHost(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^wss?:\/\//i, "")
    .replace(/^sip:/i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./i, "");
}

function brandHostCandidates(host = "") {
  const h = cleanHost(host);
  if (!h) return [];
  const parts = h.split(".").filter(Boolean);
  const out = [h];
  // Prefer root brand domain (e.g. sip.twilio.com → twilio.com)
  if (parts.length >= 3) {
    out.push(parts.slice(-2).join("."));
  }
  if (parts[0] === "sip" && parts.length >= 3) {
    out.push(parts.slice(1).join("."));
  }
  return [...new Set(out)];
}

function initialsFromName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

function toneFor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % BRAND_TONES.length;
  }
  return BRAND_TONES[hash];
}

/**
 * Premium provider mark with multi-CDN fallbacks for reliable real logos.
 */
export default function VoipProviderLogo({
  name = "",
  website = "",
  domain = "",
  size = 40,
  className = "",
}) {
  const hosts = useMemo(() => {
    const primary = cleanHost(domain) || domainFromWebsite(website);
    return brandHostCandidates(primary);
  }, [domain, website]);

  const sources = useMemo(() => {
    const list = [];
    for (const host of hosts) {
      list.push(`https://logo.clearbit.com/${host}`);
      list.push(
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
      );
      list.push(`https://icons.duckduckgo.com/ip3/${host}.ico`);
    }
    return list;
  }, [hosts]);

  const [stage, setStage] = useState(0);

  const style = {
    width: size,
    height: size,
    ["--voip-logo-tone"]: toneFor(name || hosts[0] || ""),
  };

  if (!sources.length || stage >= sources.length) {
    return (
      <span
        className={`voip-provider-logo voip-provider-logo--fallback ${className}`.trim()}
        style={style}
        aria-hidden="true"
      >
        {initialsFromName(name)}
      </span>
    );
  }

  return (
    <span
      className={`voip-provider-logo ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      <img
        key={sources[stage]}
        src={sources[stage]}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setStage((s) => s + 1)}
      />
    </span>
  );
}
