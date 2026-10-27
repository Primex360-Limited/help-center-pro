/** Shared signup / admin invite option lists (language codes match i18n). */

export const LANGUAGES = [
  { code: "en", label: "English (en)" },
  { code: "es", label: "Español (es)" },
  { code: "fr", label: "Français (fr)" },
  { code: "de", label: "Deutsch (de)" },
  { code: "zh", label: "中文 (zh)" },
  { code: "ja", label: "日本語 (ja)" },
  { code: "pt", label: "Português (pt)" },
  { code: "ru", label: "Русский (ru)" },
  { code: "ar", label: "العربية (ar)" },
  { code: "hi", label: "हिन्दी (hi)" },
];

export const TIMEZONES = [
  { value: "Africa/Lagos", label: "Africa/Lagos (GMT+1)" },
  { value: "Africa/Cairo", label: "Africa/Cairo (EET)" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg (SAST)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York (ET)" },
  { value: "America/Chicago", label: "America/Chicago (CT)" },
  { value: "America/Denver", label: "America/Denver (MT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PT)" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (BRT)" },
  { value: "America/Toronto", label: "America/Toronto (ET)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
  { value: "Europe/Madrid", label: "Europe/Madrid (CET)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
];

export const INDUSTRIES = [
  "Retail & E-commerce",
  "Technology & Software",
  "Healthcare & Life Sciences",
  "Finance & Banking",
  "Education",
  "Manufacturing",
  "Consulting & Professional Services",
  "Media & Entertainment",
  "Government & Public Sector",
  "Travel & Hospitality",
  "Telecommunications",
  "Other",
];

/** Exactly four company-size categories. */
export const COMPANY_SIZES = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201+ employees",
];

export function normalizeLanguageCode(value) {
  if (!value) return "en";
  const raw = String(value).trim();
  if (LANGUAGES.some((lang) => lang.code === raw)) return raw;

  const byLabel = LANGUAGES.find(
    (lang) =>
      lang.label.toLowerCase().startsWith(raw.toLowerCase()) ||
      lang.label.toLowerCase().includes(`(${raw.toLowerCase()})`)
  );
  if (byLabel) return byLabel.code;

  const aliases = {
    english: "en",
    spanish: "es",
    french: "fr",
    german: "de",
    chinese: "zh",
    japanese: "ja",
    portuguese: "pt",
    russian: "ru",
    arabic: "ar",
    hindi: "hi",
  };
  return aliases[raw.toLowerCase()] || "en";
}
