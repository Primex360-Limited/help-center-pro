import { Link } from "react-router-dom";
import { ArrowLeft, Construction } from "lucide-react";
import { PageHeader } from "../../components/admin/ui.jsx";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

/**
 * Tasteful placeholder for Admin Portal modules that are still on the roadmap,
 * so every sidebar link always lands on a real, branded screen.
 */
export default function AdminPlaceholder({ title, description, bullets = [] }) {
  return (
    <div className="adm-page">
      <PageHeader title={title} subtitle={description} />

      <div className="adm-card" style={{ padding: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              display: "grid",
              placeItems: "center",
              background: "rgba(245,184,61,0.12)",
              border: "1px solid rgba(245,184,61,0.32)",
              color: "#f5b83d",
            }}
          >
            <Construction size={17} />
          </span>
          <div>
            <p className="adm-card__title" style={{ margin: 0 }}>
              Coming next
            </p>
            <p className="adm-page-sub" style={{ margin: "3px 0 0" }}>
              This module is being rolled out to the platform operators.
            </p>
          </div>
        </div>

        {bullets.length ? (
          <ul
            style={{
              margin: "0 0 18px",
              paddingLeft: 18,
              color: "#b6c4dd",
              fontSize: 12.5,
              lineHeight: 1.75,
            }}
          >
            {bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}

        <Link className="adm-back" to="/admin/overview">
          <ArrowLeft size={14} /> Back to Platform Overview
        </Link>
      </div>
    </div>
  );
}
