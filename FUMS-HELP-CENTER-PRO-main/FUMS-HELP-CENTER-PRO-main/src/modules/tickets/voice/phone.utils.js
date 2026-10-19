/**
 * Normalize phone numbers to E.164 so Twilio can place real PSTN calls
 * on any carrier (MTN, Airtel, Glo, 9mobile, Verizon, etc.).
 */

const DEFAULT_REGION = "NG";

const REGION_DIAL = Object.freeze({
    NG: "234",
    US: "1",
    GB: "44",
    GH: "233",
    KE: "254",
    ZA: "27",
    IN: "91",
    CA: "1"
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

    // Already E.164-ish
    if (/^\+[1-9]\d{7,14}$/.test(trimmed.replace(/[\s()-]/g, ""))) {
        return trimmed.replace(/[\s()-]/g, "");
    }

    let digits = digitsOnly(trimmed);
    if (!digits) return null;

    const region = (options.defaultRegion || DEFAULT_REGION).toUpperCase();
    const countryCode = REGION_DIAL[region] || REGION_DIAL.NG;

    // Local NG mobile: 0803… / 0701… / 0901… → +234803…
    if (region === "NG" && /^0[789]\d{8,9}$/.test(digits)) {
        digits = countryCode + digits.slice(1);
    } else if (digits.startsWith("00") && digits.length > 4) {
        // International prefix 00…
        digits = digits.slice(2);
    } else if (
        !digits.startsWith(countryCode) &&
        digits.length >= 7 &&
        digits.length <= 11 &&
        digits.startsWith("0")
    ) {
        // Generic national trunk 0…
        digits = countryCode + digits.slice(1);
    } else if (
        !digits.startsWith(countryCode) &&
        digits.length >= 7 &&
        digits.length <= 10
    ) {
        // Bare local number without leading 0
        digits = countryCode + digits;
    }

    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
}

export function isLikelyMobileE164(e164) {
    return /^\+[1-9]\d{7,14}$/.test(String(e164 || ""));
}

export default { toE164, digitsOnly, isLikelyMobileE164 };
