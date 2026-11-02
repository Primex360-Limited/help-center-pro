/**
 * Single source of truth for platform money.
 *
 * HelpCentre Pro bills in Naira only (Paystack settles in NGN), so every
 * amount that leaves the API — plan prices, tenant MRR, invoices, analytics
 * totals — is an integer number of Naira. Never surface another currency.
 */

export const CURRENCY_CODE = "NGN";
export const CURRENCY_SYMBOL = "\u20A6";

/** Demo conversion used by the legacy USD price keys stored on old tenants. */
export const NGN_PER_USD = 1500;

/** Coerce anything into a whole-Naira integer (safe for JSON + CSV). */
export function toNaira(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.round(value);
}

/** Convert a legacy USD catalog price to Naira. */
export function usdToNaira(usd) {
    const value = Number(usd);
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.round(value * NGN_PER_USD);
}

/** `₦298,500` — server-side formatting for CSV exports and receipts. */
export function formatNaira(amount) {
    return `${CURRENCY_SYMBOL}${toNaira(amount).toLocaleString("en-NG")}`;
}

export default { toNaira, usdToNaira, formatNaira, CURRENCY_CODE, CURRENCY_SYMBOL };
