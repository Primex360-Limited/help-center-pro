import { NavLink, useLocation } from "react-router-dom";

const SETTINGS_NAV = [
  {
    to: "/workspace/profile",
    label: "General",
    end: true,
    keywords: ["general", "profile", "workspace", "timezone", "priority"],
  },
  {
    to: "/workspace/settings/api-tokens",
    label: "API Token",
    keywords: ["api", "token", "key", "integration"],
  },
  {
    to: "/workspace/settings/webhooks",
    label: "Webhook",
    keywords: ["webhook", "events", "signing"],
  },
  {
    to: "/workspace/settings/billing",
    label: "Billing",
    keywords: ["billing", "plan", "upgrade", "premium", "paystack"],
    matchPrefix: "/workspace/settings/billing",
  },
  {
    to: "/workspace/settings/configuration",
    label: "Configuration",
    keywords: ["configuration", "email", "chat", "call", "voip", "channels"],
    alsoMatch: ["/workspace/email-settings", "/workspace/voip-settings"],
  },
];

function isNavActive(item, pathname, navIsActive) {
  if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) return true;
  if (item.alsoMatch?.some((p) => pathname.startsWith(p))) return true;
  return navIsActive;
}

/** Secondary settings nav — plain labels matching the product mock. */
export default function SettingsTabs({ filterQuery = "" }) {
  const { pathname } = useLocation();
  const q = String(filterQuery || "").trim().toLowerCase();
  const items = q
    ? SETTINGS_NAV.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.includes(q))
      )
    : SETTINGS_NAV;

  if (!items.length) {
    return <p className="settings-sidenav__empty">No matching settings</p>;
  }

  return (
    <ul className="settings-sidenav__list">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `settings-sidenav__link${
                isNavActive(item, pathname, isActive) ? " is-active" : ""
              }`
            }
          >
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export { SETTINGS_NAV };
