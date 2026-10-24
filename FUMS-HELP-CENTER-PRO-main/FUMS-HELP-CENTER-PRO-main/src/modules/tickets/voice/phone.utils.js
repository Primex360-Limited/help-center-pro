/**
 * Normalize phone numbers to E.164 for SIP/PSTN dialing
 * on any carrier worldwide (MTN, Airtel, Glo, 9mobile, EE, Verizon, etc.).
 * Any `+<country><number>` or `00<country><number>` is accepted as-is;
 * bare national numbers use `defaultRegion` (defaults to NG).
 */

const DEFAULT_REGION = "NG";

const REGION_DIAL = Object.freeze({
    NG: "234", GH: "233", KE: "254", ZA: "27", US: "1", CA: "1", GB: "44",
    IN: "91", EG: "20", CM: "237", CI: "225", SN: "221", TZ: "255",
    UG: "256", RW: "250", ZM: "260", AO: "244", ET: "251", MA: "212",
    DZ: "213", TN: "216", DE: "49", FR: "33", ES: "34", IT: "39",
    NL: "31", BE: "32", CH: "41", SE: "46", NO: "47", DK: "45",
    IE: "353", PT: "351", PL: "48", TR: "90", AE: "971", SA: "966",
    QA: "974", KW: "965", IL: "972", CN: "86", JP: "81", KR: "82",
    SG: "65", MY: "60", ID: "62", PH: "63", TH: "66", VN: "84",
    AU: "61", NZ: "64", BR: "55", MX: "52", AR: "54", CO: "57",
    CL: "56", PE: "51"
});

export function digitsOnly(value = "") {
    return String(value).replace(/\D/g, "");
}

/**
 * @param {string} raw
 * @param {{ defaultRegion?: string }} [options]
 * @returns {string|null} E.164 like +2348031234567
 */
export function toE164(raw, options = {}) {
    if (!raw || typeof raw !== "string") return null;

    const trimmed = raw.trim();
    if (!trimmed) return null;

    const compact = trimmed.replace(/[\s()-]/g, "");

    // Already international: +234… / 00234…
    if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
    if (/^00[1-9]\d{7,14}$/.test(compact)) return `+${compact.slice(2)}`;

    let digits = digitsOnly(trimmed);
    if (!digits) return null;

    const region = (options.defaultRegion || DEFAULT_REGION).toUpperCase();
    const countryCode = REGION_DIAL[region] || REGION_DIAL[DEFAULT_REGION];

    if (digits.startsWith("00") && digits.length > 4) {
        digits = digits.slice(2);
    } else if (
        region === "NG" &&
        /^0[789]\d{9}$/.test(digits)
    ) {
        // Local NG mobile: 0803… / 0701… / 0901… → +234803…
        digits = countryCode + digits.slice(1);
    } else if (
        !digits.startsWith(countryCode) &&
        digits.length >= 7 &&
        digits.length <= 11 &&
        digits.startsWith("0")
    ) {
        digits = countryCode + digits.slice(1);
    } else if (
        !digits.startsWith(countryCode) &&
        digits.length >= 7 &&
        digits.length <= 10
    ) {
        digits = countryCode + digits;
    }

    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
}

export function isLikelyMobileE164(e164) {
    return /^\+[1-9]\d{7,14}$/.test(String(e164 || ""));
}

export default { toE164, digitsOnly, isLikelyMobileE164, REGION_DIAL };
