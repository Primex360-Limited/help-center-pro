import { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import SettingsTabs from "./SettingsTabs.jsx";
import "../../styles/settings-premium.css";

/**
 * Settings shell matching product mockups.
 * Main AppShell sidebar stays light blue — this secondary nav is white/gray.
 */
export default function SettingsLayout() {
  const [query, setQuery] = useState("");
  const search = useMemo(() => query.trim().toLowerCase(), [query]);

  return (
    <div className="settings-layout">
      <h1 className="settings-layout__title">Settings</h1>

      <div className="settings-layout__body">
        <aside className="settings-sidenav" aria-label="Settings navigation">
          <label className="settings-sidenav__search">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search settings"
            />
          </label>
          <SettingsTabs filterQuery={search} />
        </aside>

        <div className="settings-content">
          <p className="settings-content__lead">
            Configure your help center workspace and team preferences.
          </p>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
