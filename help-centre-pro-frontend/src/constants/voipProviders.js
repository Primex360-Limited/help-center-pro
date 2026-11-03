/**
 * VoIP/SIP provider catalog — LiveAgent-style simple tenant forms.
 * Branded providers ship with SIP host defaults; tenants enter number/user/pass.
 * Optional WSS override is available if the provider’s WebSocket URL differs.
 */

const SIMPLE_TENANT_FIELDS = [
  {
    key: "displayName",
    label: "Name",
    type: "text",
    required: false,
    placeholder: "e.g. Main support line",
  },
  {
    key: "sipCallerId",
    label: "Number",
    type: "text",
    required: true,
    placeholder: "+2348030000000",
  },
  {
    key: "sipUsername",
    label: "Username",
    type: "text",
    required: true,
    placeholder: "SIP username / extension",
  },
  {
    key: "sipPassword",
    label: "Password",
    type: "password",
    required: true,
  },
  {
    key: "dialOutPrefix",
    label: "Dial out prefix",
    type: "text",
    required: false,
    placeholder: "e.g. 003",
    hint: "Optional digits added before outbound numbers (trunk routing).",
  },
  {
    key: "recordIncoming",
    label: "Record incoming calls",
    type: "checkbox",
    required: false,
    default: true,
  },
  {
    key: "recordOutgoing",
    label: "Record outgoing calls",
    type: "checkbox",
    required: false,
    default: true,
  },
];

/**
 * Optional overrides shown under "Advanced SIP settings" for branded
 * providers. Branded hosts come from the catalog, but plenty of operators
 * (e.g. Stuncall) hand out a raw IP + port in their welcome email, so the
 * tenant must be able to correct the host. Without these the saved config had
 * no `sipServer` and every Test failed with
 * "SIP credentials incomplete. Server, username, and password are required."
 */
const BRANDED_ADVANCED_FIELDS = [
  {
    key: "sipServer",
    label: "SIP server / IP",
    type: "text",
    required: false,
    group: "advanced",
    placeholder: "e.g. 46.62.134.9 or sip.provider.com",
    hint: "Prefilled when the provider publishes a public endpoint. Otherwise copy the SIP host/IP from the provider's welcome email.",
  },
  {
    key: "sipPort",
    label: "SIP port",
    type: "text",
    required: false,
    group: "advanced",
    placeholder: "e.g. 5060",
    hint: "Signalling port from the provider. Leave empty to use 5060.",
  },
  {
    key: "sipWsUrl",
    label: "WebSocket URL (WSS)",
    type: "text",
    required: false,
    group: "advanced",
    placeholder: "wss://sip.provider.com:8089/ws",
    hint: "Optional. Leave empty and Help Centre Pro detects the provider's WebSocket automatically (or routes through the platform gateway). Paste a URL only to override the detection.",
  },
];

/**
 * Providers whose SIP endpoint was verified by DNS on 2026-11-02.
 *
 * Everything else has an account-specific host — carriers and UCaaS vendors
 * assign `<customer>.sip.brand.tld`, so a guessed hostname only produces a
 * guaranteed failure. Those providers keep an empty host and the tenant enters
 * the one from their provider portal (the field becomes required).
 */
const VERIFIED_ENDPOINTS = new Set([
  "twotalk",
  "nine_mobile_voip",
  "binotel",
  "bt_sip",
  "callnigeria",
  "callcentric",
  "cloudtalk",
  "deutsche_telekom",
  "didww",
  "entel_cl",
  "flowroute",
  "freepbx_hosted",
  "gamma",
  "google_voice_sip",
  "gradwell",
  "maroc_telecom",
  "mikrotik_voip",
  "myoperator",
  "nextiva",
  "opensips_cloud",
  "orange_business",
  "plivo",
  "ringcentral",
  "ringover",
  "signalwire",
  "sinch",
  "sipgate_de",
  "sipgate_uk",
  "stc_sa",
  "swift_networks",
  "microsoft_teams_dr",
  "telefonica_ar",
  "telia",
  "telmex",
  "telnyx",
  "twilio_sip",
  "vivo_br",
  "vodacom_business",
  "vodacom_tz",
  "vodafone_de",
  "voipms",
  "vonage_sip",
  "zadarma",
  "zoom_phone",
  // Static IP issued in Stuncall's welcome email (no DNS record needed).
  "stuncall",
]);

const CUSTOM_SIP_FIELDS = [
  {
    key: "displayName",
    label: "Name",
    type: "text",
    required: false,
    placeholder: "e.g. Office Asterisk",
  },
  {
    key: "sipServer",
    label: "SIP Server / Domain",
    type: "text",
    required: true,
    placeholder: "sip.example.com",
  },
  {
    key: "sipWsUrl",
    label: "WebSocket URL (WSS)",
    type: "text",
    required: false,
    placeholder: "wss://sip.example.com:8089/ws",
    hint: "Optional. Leave empty and Help Centre Pro finds your PBX's WebSocket automatically. Paste one only if your PBX uses a custom path or port.",
  },
  {
    key: "sipUsername",
    label: "Username",
    type: "text",
    required: true,
  },
  {
    key: "sipPassword",
    label: "Password",
    type: "password",
    required: true,
  },
  {
    key: "sipCallerId",
    label: "Number / Caller ID",
    type: "text",
    required: false,
    placeholder: "+2348030000000",
  },
  {
    key: "dialOutPrefix",
    label: "Dial out prefix",
    type: "text",
    required: false,
    placeholder: "e.g. 9 or 003",
  },
  {
    key: "recordIncoming",
    label: "Record incoming calls",
    type: "checkbox",
    required: false,
    default: true,
  },
  {
    key: "recordOutgoing",
    label: "Record outgoing calls",
    type: "checkbox",
    required: false,
    default: true,
  },
];

export function wssFor(host, port = 8089) {
  return `wss://${host}:${port}/ws`;
}

/** Raw IPv4/host:port SIP endpoints cannot host a guessed WSS path. */
export function isRawHostEndpoint(host) {
  const value = String(host || "").trim();
  if (!value) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(value)) return true;
  return /^\[[0-9a-f:]+\](:\d+)?$/i.test(value);
}

const REGION_LABELS = {
  NG: "Nigeria",
  GH: "Ghana",
  KE: "Kenya",
  ZA: "South Africa",
  TZ: "Tanzania",
  UG: "Uganda",
  CI: "Côte d’Ivoire",
  SN: "Senegal",
  MA: "Morocco",
  EG: "Egypt",
  SL: "Sierra Leone",
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  NO: "Norway",
  SE: "Sweden",
  FI: "Finland",
  IT: "Italy",
  ES: "Spain",
  UA: "Ukraine",
  EU: "Europe",
  IN: "India",
  SG: "Singapore",
  MY: "Malaysia",
  JP: "Japan",
  CN: "China",
  HK: "Hong Kong",
  AU: "Australia",
  NZ: "New Zealand",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  BR: "Brazil",
  MX: "Mexico",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  TH: "Thailand",
  GLOBAL: "Global",
};

export function regionLabel(code = "") {
  const key = String(code || "").toUpperCase();
  return REGION_LABELS[key] || key || "Global";
}

export function primaryRegionLabel(regions = []) {
  const list = Array.isArray(regions) ? regions : [];
  const first = list.find((r) => String(r).toUpperCase() !== "GLOBAL") || list[0] || "GLOBAL";
  return regionLabel(first);
}

function logoDomainFromWebsite(website = "") {
  try {
    const url = new URL(
      /^https?:\/\//i.test(website) ? website : `https://${website}`
    );
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function brandedProvider({
  id,
  name,
  category,
  website = "",
  description,
  features = ["SIP trunk", "Browser softphone", "Recording"],
  regions = ["GLOBAL"],
  sipServer,
  sipWsUrl,
  sipVerified = false,
  dialOutPrefix = "",
  sipPort = "",
}) {
  const host = sipServer;
  const websiteDomain = logoDomainFromWebsite(website);
  const sipBrandDomain = String(host || "")
    .replace(/^sip\./i, "")
    .replace(/^[\w-]+\./, (m) => (m.toLowerCase() === "sip." ? "" : m));
  const sipServerField = {
    ...BRANDED_ADVANCED_FIELDS[0],
    required: !host,
    hint: host
      ? `Verified endpoint: ${host}. Change it only if ${name} gave you a different host.`
      : `Required — ${name} assigns the SIP host/IP per account. Copy it from their welcome email or portal.`,
  };
  return {
    id,
    name,
    logo: null,
    logoDomain:
      websiteDomain ||
      logoDomainFromWebsite(host ? `https://${String(host).replace(/^sip\./i, "")}` : "") ||
      sipBrandDomain,
    category,
    website,
    description:
      description ||
      `${name} SIP — enter your number, username, and password from ${name}.`,
    features,
    authFields: [],
    sipFields: [
      ...SIMPLE_TENANT_FIELDS,
      sipServerField,
      ...BRANDED_ADVANCED_FIELDS.slice(1),
    ],
    defaults: {
      sipServer: host || "",
      // Never invent a WebSocket URL: a wrong guess only hides the real
      // problem. Tenants paste the WSS from the provider when they have one.
      sipWsUrl: sipWsUrl || "",
      sipPort: sipPort || "",
      dialOutPrefix,
      stunServer: "stun:stun.l.google.com:19302",
    },
    simpleSetup: true,
    /** Public endpoint confirmed (DNS / provider sheet) — safe to prefill. */
    verifiedHost: Boolean(host && sipVerified),
    /** Tenant must supply the host before this provider can work. */
    requiresHost: !host,
    regions,
    supportsRecording: true,
    supportsTranscription: false,
    sdk: "jssip",
  };
}

/** Compact catalog entries: [id, name, category, website, sipServer, regions?, dialPrefix?, wss?] */
const BRANDED_CATALOG = [
  // ——— Nigeria ———
  ["twotalk", "2talk", "global", "https://2talk.com/", "sip.2talk.com", ["US", "GLOBAL"], "003"],
  // Stuncall hands out a raw SIP IP + port in its welcome email
  // ("IP Address: 46.62.134.9 / Port Number: 5060"), not a hostname. No `wss://`
  // endpoint exists on that host or on stuncall.com (verified: no DNS for
  // sip./voip./wss.stuncall.com, no WebSocket upgrade on the IP), so browser
  // calling for Stuncall relies on either the provider supplying a WSS URL or
  // the platform WebRTC gateway (VITE_SIP_DEFAULT_WSS / SIP_DEFAULT_WSS).
  // Everything is auto-detected at registration time — agents never type it.
  ["stuncall", "Stuncall", "nigeria", "https://stuncall.com", "46.62.134.9", ["NG", "GH", "KE", "ZA"], "", "", "5060"],
  ["smilecoms", "SmileComs", "nigeria", "https://smilecoms.com", "sip.smilecoms.com", ["NG", "ZA", "KE", "GH", "TZ"]],
  ["terragon", "Terragon", "nigeria", "https://terragon.net", "sip.terragon.net", ["NG"]],
  ["cloudfone", "CloudFone", "nigeria", "https://cloudfone.ng", "sip.cloudfone.ng", ["NG"]],
  ["voip_nigeria", "VoIP Nigeria", "nigeria", "https://voipnigeria.com", "sip.voipnigeria.com", ["NG"]],
  ["mtn_business_voip", "MTN Business VoIP", "nigeria", "https://business.mtn.ng", "sip.business.mtn.ng", ["NG"]],
  ["airtel_business_voip", "Airtel Business VoIP", "nigeria", "https://airtel.africa/business", "sip.airtelbusiness.ng", ["NG"]],
  ["spectranet_voip", "Spectranet VoIP", "nigeria", "https://spectranet.com.ng", "sip.spectranet.com.ng", ["NG"]],
  ["glo_business_voip", "Glo Business VoIP", "nigeria", "https://gloworld.com", "sip.business.gloworld.com", ["NG"]],
  ["nine_mobile_voip", "9mobile Business VoIP", "nigeria", "https://9mobile.com.ng", "sip.business.9mobile.com.ng", ["NG"]],
  ["ipnx_voip", "ipNX VoIP", "nigeria", "https://ipnxnigeria.net", "sip.ipnxnigeria.net", ["NG"]],
  ["swift_networks", "Swift Networks VoIP", "nigeria", "https://swiftng.com", "sip.swiftng.com", ["NG"]],
  ["mainone_voip", "MainOne VoIP", "nigeria", "https://mainone.net", "sip.mainone.net", ["NG"]],
  ["tizeti_voip", "Tizeti VoIP", "nigeria", "https://tizeti.com", "sip.tizeti.com", ["NG"]],
  ["smile_ng_voip", "Smile Nigeria VoIP", "nigeria", "https://smile.com.ng", "sip.smile.com.ng", ["NG"]],
  ["africell_voip", "Africell VoIP", "nigeria", "https://africell.com", "sip.africell.com", ["NG", "UG", "SL"]],
  ["callnigeria", "Call Nigeria SIP", "nigeria", "", "sip.callnigeria.com", ["NG"]],

  // ——— Africa ———
  ["safaricom_business", "Safaricom Business SIP", "africa", "https://www.safaricom.co.ke", "sip.safaricom.co.ke", ["KE"]],
  ["airtel_kenya", "Airtel Kenya Business", "africa", "https://www.airtel.ke", "sip.business.airtel.ke", ["KE"]],
  ["vodacom_business", "Vodacom Business SIP", "africa", "https://www.vodacom.co.za", "sip.business.vodacom.co.za", ["ZA"]],
  ["mtn_za", "MTN South Africa Business", "africa", "https://www.mtn.co.za", "sip.business.mtn.co.za", ["ZA"]],
  ["telkom_za", "Telkom South Africa SIP", "africa", "https://www.telkom.co.za", "sip.telkom.co.za", ["ZA"]],
  ["rain_za", "Rain Business SIP", "africa", "https://www.rain.co.za", "sip.rain.co.za", ["ZA"]],
  ["mtn_gh", "MTN Ghana Business", "africa", "https://www.mtn.com.gh", "sip.business.mtn.com.gh", ["GH"]],
  ["vodafone_gh", "Vodafone Ghana Business", "africa", "https://www.vodafone.com.gh", "sip.business.vodafone.com.gh", ["GH"]],
  ["orange_ci", "Orange Côte d’Ivoire SIP", "africa", "https://www.orange.ci", "sip.orange.ci", ["CI"]],
  ["mtn_ci", "MTN Côte d’Ivoire SIP", "africa", "https://www.mtn.ci", "sip.business.mtn.ci", ["CI"]],
  ["orange_sn", "Orange Senegal SIP", "africa", "https://www.orange.sn", "sip.orange.sn", ["SN"]],
  ["vodacom_tz", "Vodacom Tanzania SIP", "africa", "https://www.vodacom.co.tz", "sip.vodacom.co.tz", ["TZ"]],
  ["airtel_ug", "Airtel Uganda Business", "africa", "https://www.airtel.co.ug", "sip.business.airtel.co.ug", ["UG"]],
  ["mtn_ug", "MTN Uganda Business", "africa", "https://www.mtn.co.ug", "sip.business.mtn.co.ug", ["UG"]],
  ["maroc_telecom", "Maroc Telecom SIP", "africa", "https://www.iam.ma", "sip.iam.ma", ["MA"]],
  ["orange_ma", "Orange Morocco SIP", "africa", "https://www.orange.ma", "sip.orange.ma", ["MA"]],
  ["etisalat_eg", "Etisalat Misr SIP", "africa", "https://www.etisalat.eg", "sip.etisalat.eg", ["EG"]],
  ["vodafone_eg", "Vodafone Egypt SIP", "africa", "https://www.vodafone.eg", "sip.vodafone.eg", ["EG"]],
  ["orange_eg", "Orange Egypt SIP", "africa", "https://www.orange.eg", "sip.orange.eg", ["EG"]],

  // ——— Global / Americas SIP trunks ———
  ["voipms", "VoIP.ms", "americas", "https://voip.ms", "montreal1.voip.ms", ["US", "CA", "GLOBAL"]],
  ["callcentric", "Callcentric", "americas", "https://www.callcentric.com", "callcentric.com", ["US", "GLOBAL"]],
  ["flowroute", "Flowroute", "americas", "https://www.flowroute.com", "sip.flowroute.com", ["US", "GLOBAL"]],
  ["telnyx", "Telnyx", "americas", "https://telnyx.com", "sip.telnyx.com", ["US", "GLOBAL"]],
  ["bandwidth", "Bandwidth", "americas", "https://www.bandwidth.com", "sip.bandwidth.com", ["US", "GLOBAL"]],
  ["signalwire", "SignalWire", "americas", "https://signalwire.com", "sip.signalwire.com", ["US", "GLOBAL"]],
  ["vonage_sip", "Vonage SIP Trunking", "americas", "https://www.vonage.com", "sip.nexmo.com", ["US", "GLOBAL"]],
  ["plivo", "Plivo", "americas", "https://www.plivo.com", "sip.plivo.com", ["US", "GLOBAL"]],
  ["sinch", "Sinch Voice", "americas", "https://www.sinch.com", "sip.sinch.com", ["US", "GLOBAL"]],
  ["twilio_sip", "Twilio Elastic SIP (BYO)", "americas", "https://www.twilio.com", "sip.twilio.com", ["US", "GLOBAL"]],
  ["didww", "DIDWW", "americas", "https://www.didww.com", "sip.didww.com", ["US", "GLOBAL"]],
  ["didlogic", "DIDLogic", "americas", "https://didlogic.com", "sip.didlogic.com", ["US", "GLOBAL"]],
  ["voipunlimited", "VoIP Unlimited", "europe", "https://www.voipunlimited.net", "sip.voipunlimited.net", ["GB", "GLOBAL"]],
  ["sipgate_uk", "sipgate UK", "europe", "https://www.sipgate.co.uk", "sipgate.co.uk", ["GB"]],
  ["sipgate_de", "sipgate Germany", "europe", "https://www.sipgate.de", "sipgate.de", ["DE"]],
  ["zadarma", "Zadarma", "europe", "https://zadarma.com", "sip.zadarma.com", ["GLOBAL"]],
  ["binotel", "Binotel", "europe", "https://www.binotel.ua", "sip.binotel.com", ["UA", "GLOBAL"]],
  ["ringover", "Ringover", "europe", "https://www.ringover.com", "sip.ringover.com", ["FR", "GLOBAL"]],
  ["aircall", "Aircall", "europe", "https://aircall.io", "sip.aircall.io", ["GLOBAL"]],
  ["cloudtalk", "CloudTalk", "europe", "https://www.cloudtalk.io", "sip.cloudtalk.io", ["GLOBAL"]],
  ["justcall", "JustCall", "americas", "https://justcall.io", "sip.justcall.io", ["GLOBAL"]],
  ["dialpad", "Dialpad", "americas", "https://www.dialpad.com", "sip.dialpad.com", ["US", "GLOBAL"]],
  ["ringcentral", "RingCentral SIP", "americas", "https://www.ringcentral.com", "sip.ringcentral.com", ["US", "GLOBAL"]],
  ["nextiva", "Nextiva", "americas", "https://www.nextiva.com", "sip.nextiva.com", ["US"]],
  ["eightxeight", "8x8", "americas", "https://www.8x8.com", "sip.8x8.com", ["US", "GLOBAL"]],
  ["zoom_phone", "Zoom Phone SIP", "americas", "https://www.zoom.us", "sip.zoom.us", ["US", "GLOBAL"]],
  ["microsoft_teams_dr", "Teams Direct Routing", "americas", "https://www.microsoft.com", "sip.pstnhub.microsoft.com", ["GLOBAL"]],
  ["google_voice_sip", "Google Voice SIP Link", "americas", "https://voice.google.com", "sip.voice.google.com", ["US"]],
  ["onoff", "Onoff Business", "europe", "https://www.onoff.app", "sip.onoff.app", ["EU", "GLOBAL"]],
  ["wildix", "Wildix", "europe", "https://www.wildix.com", "sip.wildix.com", ["EU", "GLOBAL"]],
  ["threecx", "3CX Hosted", "europe", "https://www.3cx.com", "sip.3cx.com", ["GLOBAL"]],
  ["freepbx_hosted", "FreePBX / Sangoma", "americas", "https://www.sangoma.com", "sip.sangoma.com", ["GLOBAL"]],
  ["asterisk_cloud", "Asterisk Cloud Hosting", "americas", "", "sip.asterisk.cloud", ["GLOBAL"]],
  ["vitalpbx", "VitalPBX", "americas", "https://www.vitalpbx.com", "sip.vitalpbx.com", ["GLOBAL"]],
  ["issabel", "Issabel Cloud", "americas", "https://www.issabel.com", "sip.issabel.com", ["GLOBAL"]],
  ["fusionpbx", "FusionPBX Hosted", "americas", "https://www.fusionpbx.com", "sip.fusionpbx.com", ["GLOBAL"]],

  // ——— Europe carriers / ITSPs ———
  ["bt_sip", "BT Business SIP", "europe", "https://business.bt.com", "sip.bt.com", ["GB"]],
  ["vodafone_uk", "Vodafone UK Business SIP", "europe", "https://www.vodafone.co.uk", "sip.vodafone.co.uk", ["GB"]],
  ["gamma", "Gamma Telecom", "europe", "https://www.gamma.co.uk", "sip.gamma.co.uk", ["GB"]],
  ["gradwell", "Gradwell", "europe", "https://www.gradwell.com", "sip.gradwell.com", ["GB"]],
  ["magrathea", "Magrathea", "europe", "https://www.magrathea-telecom.co.uk", "sip.magrathea-telecom.co.uk", ["GB"]],
  ["orange_business", "Orange Business SIP", "europe", "https://www.orange-business.com", "sip.orange-business.com", ["FR", "GLOBAL"]],
  ["deutsche_telekom", "Deutsche Telekom SIP", "europe", "https://www.telekom.de", "sip.telekom.de", ["DE"]],
  ["vodafone_de", "Vodafone Germany SIP", "europe", "https://www.vodafone.de", "sip.vodafone.de", ["DE"]],
  ["swisscom", "Swisscom Business SIP", "europe", "https://www.swisscom.ch", "sip.swisscom.ch", ["CH"]],
  ["kpn", "KPN Zakelijk SIP", "europe", "https://www.kpn.com", "sip.kpn.com", ["NL"]],
  ["proximus", "Proximus SIP", "europe", "https://www.proximus.be", "sip.proximus.be", ["BE"]],
  ["telenor", "Telenor Business SIP", "europe", "https://www.telenor.com", "sip.telenor.com", ["NO", "GLOBAL"]],
  ["telia", "Telia Business SIP", "europe", "https://www.telia.com", "sip.telia.com", ["SE", "FI"]],
  ["tim_business", "TIM Business SIP", "europe", "https://www.tim.it", "sip.tim.it", ["IT"]],
  ["telefonica", "Telefónica SIP", "europe", "https://www.telefonica.com", "sip.telefonica.com", ["ES", "GLOBAL"]],
  ["colt", "COLT SIP Trunking", "europe", "https://www.colt.net", "sip.colt.net", ["EU", "GLOBAL"]],
  ["voxbone", "Voxbone (Bandwidth)", "europe", "https://www.bandwidth.com", "sip.voxbone.com", ["EU", "GLOBAL"]],
  ["messagebird", "Bird (MessageBird) Voice", "europe", "https://bird.com", "sip.messagebird.com", ["EU", "GLOBAL"]],
  ["exotel", "Exotel", "asia", "https://exotel.com", "sip.exotel.com", ["IN", "GLOBAL"]],
  ["knowlarity", "Knowlarity", "asia", "https://www.knowlarity.com", "sip.knowlarity.com", ["IN", "GLOBAL"]],
  ["ozonetel", "Ozonetel", "asia", "https://ozonetel.com", "sip.ozonetel.com", ["IN"]],
  ["myoperator", "MyOperator", "asia", "https://myoperator.com", "sip.myoperator.com", ["IN"]],
  ["tata_tele", "Tata Tele Business SIP", "asia", "https://www.tatatelebusiness.com", "sip.tatatelebusiness.com", ["IN"]],
  ["airtel_in", "Airtel India Business SIP", "asia", "https://www.airtel.in", "sip.business.airtel.in", ["IN"]],
  ["jio_business", "JioBusiness SIP", "asia", "https://www.jio.com", "sip.jio.com", ["IN"]],
  ["singtel", "Singtel Business SIP", "asia", "https://www.singtel.com", "sip.singtel.com", ["SG"]],
  ["starhub", "StarHub Business SIP", "asia", "https://www.starhub.com", "sip.starhub.com", ["SG"]],
  ["tm_malaysia", "TM Business SIP", "asia", "https://www.tm.com.my", "sip.tm.com.my", ["MY"]],
  ["ntt", "NTT Communications SIP", "asia", "https://www.ntt.com", "sip.ntt.com", ["JP", "GLOBAL"]],
  ["kddi", "KDDI Business SIP", "asia", "https://www.kddi.com", "sip.kddi.com", ["JP"]],
  ["softbank", "SoftBank Business SIP", "asia", "https://www.softbank.jp", "sip.softbank.jp", ["JP"]],
  ["china_telecom", "China Telecom SIP", "asia", "https://www.chinatelecom.com.cn", "sip.chinatelecom.com", ["CN"]],
  ["pccw", "PCCW Business SIP", "asia", "https://www.pccw.com", "sip.pccw.com", ["HK"]],
  ["optus", "Optus Business SIP", "asia", "https://www.optus.com.au", "sip.optus.com.au", ["AU"]],
  ["telstra", "Telstra Business SIP", "asia", "https://www.telstra.com.au", "sip.telstra.com.au", ["AU"]],
  ["vodafone_au", "Vodafone Australia SIP", "asia", "https://www.vodafone.com.au", "sip.vodafone.com.au", ["AU"]],
  ["spark_nz", "Spark NZ Business SIP", "asia", "https://www.spark.co.nz", "sip.spark.co.nz", ["NZ"]],
  ["vodafone_nz", "One NZ (Vodafone) SIP", "asia", "https://one.nz", "sip.one.nz", ["NZ"]],

  // ——— Middle East ———
  ["etisalat_ae", "Etisalat UAE Business", "global", "https://www.etisalat.ae", "sip.etisalat.ae", ["AE"]],
  ["du_ae", "du Business SIP", "global", "https://www.du.ae", "sip.du.ae", ["AE"]],
  ["stc_sa", "STC Business SIP", "global", "https://www.stc.com.sa", "sip.stc.com.sa", ["SA"]],
  ["mobily", "Mobily Business SIP", "global", "https://www.mobily.com.sa", "sip.mobily.com.sa", ["SA"]],
  ["ooredoo_qa", "Ooredoo Qatar SIP", "global", "https://www.ooredoo.qa", "sip.ooredoo.qa", ["QA"]],
  ["zain_kw", "Zain Kuwait SIP", "global", "https://www.kw.zain.com", "sip.zain.com", ["KW"]],

  // ——— LATAM ———
  ["claro_br", "Claro Brasil SIP", "americas", "https://www.claro.com.br", "sip.claro.com.br", ["BR"]],
  ["vivo_br", "Vivo Empresas SIP", "americas", "https://www.vivo.com.br", "sip.vivo.com.br", ["BR"]],
  ["telmex", "Telmex Empresas SIP", "americas", "https://www.telmex.com", "sip.telmex.com", ["MX"]],
  ["telefonica_ar", "Telefónica Argentina SIP", "americas", "https://www.telefonica.com.ar", "sip.telefonica.com.ar", ["AR"]],
  ["entel_cl", "Entel Empresas SIP", "americas", "https://www.entel.cl", "sip.entel.cl", ["CL"]],
  ["claro_co", "Claro Colombia SIP", "americas", "https://www.claro.com.co", "sip.claro.com.co", ["CO"]],

  // ——— Popular cloud contact / UCaaS SIP ———
  ["genesys_cloud", "Genesys Cloud SIP", "global", "https://www.genesys.com", "sip.mypurecloud.com", ["GLOBAL"]],
  ["five9", "Five9 SIP", "americas", "https://www.five9.com", "sip.five9.com", ["US", "GLOBAL"]],
  ["talkdesk", "Talkdesk", "americas", "https://www.talkdesk.com", "sip.talkdesk.com", ["US", "GLOBAL"]],
  ["nice_cxone", "NICE CXone SIP", "americas", "https://www.nice.com", "sip.nice.com", ["US", "GLOBAL"]],
  ["avaya_cloud", "Avaya Cloud SIP", "americas", "https://www.avaya.com", "sip.avaya.com", ["GLOBAL"]],
  ["cisco_webex", "Webex Calling SIP", "americas", "https://www.webex.com", "sip.webex.com", ["GLOBAL"]],
  ["mitel", "Mitel Cloud SIP", "americas", "https://www.mitel.com", "sip.mitel.com", ["GLOBAL"]],
  ["yeastar", "Yeastar Cloud PBX", "asia", "https://www.yeastar.com", "sip.yeastar.com", ["GLOBAL"]],
  ["grandstream_ucm", "Grandstream UCM Cloud", "americas", "https://www.grandstream.com", "sip.grandstream.com", ["GLOBAL"]],
  ["fanvil_cloud", "Fanvil Cloud", "asia", "https://www.fanvil.com", "sip.fanvil.com", ["GLOBAL"]],
  ["mikrotik_voip", "MikroTik SIP", "europe", "https://mikrotik.com", "sip.mikrotik.com", ["GLOBAL"]],
  ["kamailio_cloud", "Kamailio Hosted", "europe", "https://www.kamailio.org", "sip.kamailio.org", ["GLOBAL"]],
  ["opensips_cloud", "OpenSIPS Hosted", "europe", "https://www.opensips.org", "sip.opensips.org", ["GLOBAL"]],
];

function fromCatalogRow(row) {
  const [
    id,
    name,
    category,
    website,
    sipServer,
    regions,
    dialOutPrefix,
    sipWsUrl,
    sipPort,
  ] = row;
  const verified = VERIFIED_ENDPOINTS.has(id);
  return brandedProvider({
    id,
    name,
    category,
    website,
    // Only prefill endpoints we could verify; a guessed host fails 100% of the
    // time and makes the whole provider look broken.
    sipServer: verified ? sipServer : "",
    sipVerified: verified,
    regions: regions || ["GLOBAL"],
    dialOutPrefix: dialOutPrefix || "",
    sipWsUrl: sipWsUrl || undefined,
    sipPort: sipPort || "",
    features: ["SIP trunk", "Browser softphone", "Call recording"],
  });
}

export const VOIP_PROVIDERS = [
  {
    id: "custom_sip",
    name: "Custom SIP / Free PBX",
    logo: null,
    logoDomain: "",
    category: "custom",
    website: "https://www.asterisk.org",
    description:
      "Any self-hosted or unknown SIP PBX (Asterisk, FreeSWITCH, 3CX, Issabel…). Enter host + WSS from your admin.",
    features: ["Any SIP provider", "Full control", "Browser softphone"],
    authFields: [],
    sipFields: CUSTOM_SIP_FIELDS,
    defaults: {},
    simpleSetup: false,
    verifiedHost: false,
    requiresHost: true,
    regions: ["GLOBAL"],
    supportsRecording: true,
    supportsTranscription: false,
    sdk: "jssip",
  },
  ...BRANDED_CATALOG.map(fromCatalogRow),
];

export const PROVIDER_CATEGORIES = {
  custom: "Custom / Self-hosted",
  nigeria: "Nigeria",
  africa: "Africa",
  americas: "Americas",
  europe: "Europe",
  asia: "Asia-Pacific",
  global: "Global / Middle East",
};

export function getProviderById(id) {
  return VOIP_PROVIDERS.find((p) => p.id === id) || null;
}

export function getProvidersByCategory(category) {
  return VOIP_PROVIDERS.filter((p) => p.category === category);
}

export function getProvidersByRegion(region) {
  return VOIP_PROVIDERS.filter(
    (p) => p.regions.includes(region) || p.regions.includes("GLOBAL")
  );
}

/**
 * Merge baked-in provider defaults with tenant-entered credentials.
 * Tenant WSS override wins; otherwise default WSS or auto wss://host:8089/ws.
 */
export function resolveSipCredentials(providerId, credentials = {}) {
  const provider = getProviderById(providerId);
  const defaults =
    provider?.defaults && typeof provider.defaults === "object"
      ? provider.defaults
      : {};

  const merged = {
    ...defaults,
    ...credentials,
    sipUsername:
      credentials.sipUsername ||
      credentials.sipUser ||
      defaults.sipUsername ||
      "",
    sipPassword:
      credentials.sipPassword ||
      credentials.sipPass ||
      defaults.sipPassword ||
      "",
    sipCallerId:
      credentials.sipCallerId ||
      credentials.number ||
      credentials.phoneNumber ||
      defaults.sipCallerId ||
      "",
  };

  const host =
    merged.sipServer ||
    merged.sipDomain ||
    merged.sipHost ||
    merged.sipRealm ||
    "";

  const tenantWs = String(
    credentials.sipWsUrl || credentials.wssUrl || ""
  ).trim();
  if (tenantWs) {
    merged.sipWsUrl = /^wss?:\/\//i.test(tenantWs)
      ? tenantWs
      : `wss://${tenantWs}`;
  }

  // Deliberately no guessed WSS here: inventing `wss://<ip>:8089/ws` hides the
  // real problem. The softphone reports exactly what is missing instead.
  if (!merged.sipServer && host) merged.sipServer = host;

  return merged;
}

export function getProviderCount() {
  return VOIP_PROVIDERS.length;
}
