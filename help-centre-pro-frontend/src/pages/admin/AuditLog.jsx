import { useCallback, useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { exportAuditCsv, getAuditLog } from "../../api/admin.api.js";
import {
  EmptyBlock,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  SuccessBanner,
} from "../../components/admin/ui.jsx";
import { formatDateTime } from "../../utils/currency.js";
import "../../styles/admin.css";
import "../../styles/admin-platform.css";

function actionLabel(action = "") {
  return String(action)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (search) => {
    setLoading(true);
    setError("");
    try {
      const result = await getAuditLog({ q: search, limit: 150 });
      setEntries(result?.data?.entries || []);
    } catch (err) {
      setError(err.message || "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(q), 220);
    return () => clearTimeout(timer);
  }, [q, load]);

  async function handleExport() {
    setExporting(true);
    setError("");
    setNotice("");
    try {
      await exportAuditCsv({ q, limit: 300 });
      setNotice("Audit log exported as CSV.");
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="adm-page">
      <PageHeader title="Audit log">
        <button
          type="button"
          className="adm-btn adm-btn--light"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download size={14} />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </PageHeader>

      <ErrorBanner message={error} onRetry={() => load(q)} />
      <SuccessBanner message={notice} />

      <div className="adm-filterbar">
        <div className="adm-search-inline">
          <Search size={15} />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search by action, tenant, or admin email..."
            aria-label="Search audit log"
          />
        </div>
      </div>

      <div className="adm-table-card">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Entity</th>
              <th>Workspace</th>
              <th>Actor</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="is-static">
                <td colSpan={5}>
                  <LoadingBlock label="Loading audit trail…" />
                </td>
              </tr>
            ) : entries.length ? (
              entries.map((entry) => (
                <tr key={entry.id} className="is-static">
                  <td className="adm-strong">{actionLabel(entry.action)}</td>
                  <td className="adm-muted">{entry.entity || "—"}</td>
                  <td>{entry.tenantName || "Platform"}</td>
                  <td className="adm-muted">{entry.actorEmail || "System"}</td>
                  <td className="adm-muted">{formatDateTime(entry.createdAt)}</td>
                </tr>
              ))
            ) : (
              <tr className="is-static">
                <td colSpan={5}>
                  <EmptyBlock
                    title="No audit entries"
                    hint="Platform actions appear here as soon as they happen."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
