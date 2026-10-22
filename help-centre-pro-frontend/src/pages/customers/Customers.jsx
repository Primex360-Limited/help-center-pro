import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Loader2, Mail, Phone, Search } from "lucide-react";
import { listCustomers } from "../../api/customers.api.js";
import "../../styles/customers.css";

const AVATAR_COLORS = ["#b54708", "#1570ef", "#eaaa08", "#c11574", "#027a48", "#7a5af8", "#dc6803"];

function initials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function colorFor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Customers — derived live from real ticket history (never fabricated). */
export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await listCustomers();
        setCustomers(res?.data?.customers || []);
      } catch (err) {
        setError(err.message || "Unable to load customers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <div className="cust-page">
      <h1 className="cust-title">Customers</h1>

      <label className="cust-search">
        <Search size={16} />
        <input
          type="search"
          placeholder="Search Customers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>

      {loading ? (
        <p className="cust-loading">
          <Loader2 size={16} className="cust-spin" /> Loading customers…
        </p>
      ) : error ? (
        <p className="cust-error">{error}</p>
      ) : (
        <div className="cust-card">
          <table className="cust-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Tickets</th>
                <th>Phone NUmber</th>
                <th aria-label="Open profile" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="cust-row"
                >
                  <td>
                    <span className="cust-customer-cell">
                      <span
                        className="cust-avatar"
                        style={{ background: colorFor(customer.name) }}
                        aria-hidden="true"
                      >
                        {initials(customer.name)}
                      </span>
                      <span className="cust-name-wrap">
                        <strong>{customer.name}</strong>
                        {customer.isActive ? (
                          <span className="cust-active-badge">Active</span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td>
                    {customer.email ? (
                      <span className="cust-contact">
                        <Mail size={13} /> {customer.email}
                      </span>
                    ) : (
                      <span className="cust-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="cust-ticket-count">{customer.ticketCount}</span>
                  </td>
                  <td>
                    {customer.phone ? (
                      <span className="cust-contact">
                        <Phone size={13} /> {customer.phone}
                      </span>
                    ) : (
                      <span className="cust-muted">—</span>
                    )}
                  </td>
                  <td className="cust-chevron">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cust-empty">
                    {customers.length === 0
                      ? "No customers yet — customers appear here automatically when tickets are created for them."
                      : "No customers match your search."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
