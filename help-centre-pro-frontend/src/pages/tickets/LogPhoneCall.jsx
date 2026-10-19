import { useEffect, useMemo, useState } from "react";
import { Phone, PhoneCall, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createTicket,
  listTickets,
  placeOutboundCall,
} from "../../api/tickets.api.js";
import {
  extractCustomersFromTickets,
  formatRelative,
} from "./channelUtils.js";
import "../../styles/channels.css";

const DRAFT_KEY = "hcp.phoneCall.draft";

const CALL_TYPES = [
  {
    value: "incoming",
    label: "Incoming call",
    description: "Customer called in",
    direction: "INBOUND",
  },
  {
    value: "outgoing",
    label: "outgoing call",
    description: "Agent called customer",
    direction: "OUTBOUND",
  },
  {
    value: "missed",
    label: "Missed call",
    description: "Create ticket for callback",
    direction: "INBOUND",
  },
];

export default function LogPhoneCall() {
  const navigate = useNavigate();
  const [callType, setCallType] = useState("incoming");
  const [phone, setPhone] = useState("");
  const [recentCalls, setRecentCalls] = useState([]);
  const [recentSelect, setRecentSelect] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const isOutgoing = callType === "outgoing";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await listTickets({
          channel: "PHONE",
          page: 1,
          limit: 100,
        });
        if (cancelled) return;
        const tickets = result?.data?.tickets || [];
        setRecentCalls(
          tickets
            .slice()
            .sort(
              (a, b) =>
                new Date(b.updatedAt || b.createdAt) -
                new Date(a.updatedAt || a.createdAt)
            )
            .slice(0, 20)
        );
        setCustomers(extractCustomersFromTickets(tickets));
      } catch {
        if (!cancelled) {
          setRecentCalls([]);
          setCustomers([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.callType) setCallType(draft.callType);
      if (draft.phone) setPhone(draft.phone);
      if (draft.name) setName(draft.name);
      if (draft.email) setEmail(draft.email);
      if (draft.company) setCompany(draft.company);
      if (draft.customerId) setCustomerId(draft.customerId);
      setNotice("Draft restored from this browser.");
    } catch {
      /* ignore */
    }
  }, []);

  const searchMatches = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter((c) =>
        `${c.name} ${c.email} ${c.phone} ${c.customerId}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 6);
  }, [customers, customerSearch]);

  function applyCustomer(customer) {
    setName(customer.name || "");
    setEmail(customer.email || "");
    setCustomerId(customer.customerId || "");
    if (customer.phone) setPhone(customer.phone);
    if (customer.company) setCompany(customer.company);
    setCustomerSearch("");
  }

  function lookupCustomer() {
    setLookingUp(true);
    setError("");
    const digits = phone.replace(/\D/g, "");
    const match = customers.find((c) => {
      const cDigits = String(c.phone || "").replace(/\D/g, "");
      return (
        (digits && cDigits && cDigits.includes(digits)) ||
        (digits && cDigits && digits.includes(cDigits))
      );
    });
    if (match) {
      applyCustomer(match);
      setNotice(`Matched customer ${match.name}.`);
    } else {
      setNotice("No matching customer found for that number.");
    }
    setLookingUp(false);
  }

  function onRecentChange(value) {
    setRecentSelect(value);
    const ticket = recentCalls.find(
      (t) => t.ticketId === value || t.id === value
    );
    if (!ticket) return;
    if (ticket.customer?.phone) setPhone(ticket.customer.phone);
    if (ticket.customer?.name) setName(ticket.customer.name);
    if (ticket.customer?.email) setEmail(ticket.customer.email);
    if (ticket.customer?.customerId) setCustomerId(ticket.customer.customerId);
  }

  function saveDraft() {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        callType,
        phone,
        name,
        email,
        company,
        customerId,
        savedAt: new Date().toISOString(),
      })
    );
    setNotice("Draft saved locally.");
    setError("");
  }

  async function handlePlaceCall(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!phone.trim()) {
      setError("Customer phone number is required.");
      return;
    }

    setPlacing(true);
    try {
      const result = await placeOutboundCall({
        to: phone.trim(),
        customerName: name.trim() || undefined,
        customerEmail: email.trim() || undefined,
        title: `Outbound call to ${name.trim() || phone.trim()}`,
        defaultRegion: "NG",
      });
      const data = result?.data || result;
      const ticketId = data?.ticketId;
      localStorage.removeItem(DRAFT_KEY);
      navigate(
        ticketId
          ? `/tickets/calls?ticket=${encodeURIComponent(ticketId)}`
          : "/tickets/calls",
        {
          replace: true,
          state: {
            notice:
              data?.message ||
              "Calling customer from your HelpCentre Pro line…",
          },
        }
      );
    } catch (err) {
      setError(err.message || "Unable to place call");
    } finally {
      setPlacing(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    const typeMeta = CALL_TYPES.find((t) => t.value === callType) || CALL_TYPES[0];
    const titleParts = [typeMeta.label, name || phone.trim()].filter(Boolean);
    const descriptionParts = [
      `Call type: ${typeMeta.label}`,
      `Phone: ${phone.trim()}`,
      name ? `Customer: ${name}` : null,
      email ? `Email: ${email}` : null,
      company ? `Company: ${company}` : null,
      customerId ? `Customer ID: ${customerId}` : null,
    ].filter(Boolean);

    setSubmitting(true);
    try {
      const payload = {
        title: titleParts.join(" — "),
        description: descriptionParts.join("\n"),
        priority: "MEDIUM",
        channel: "PHONE",
        ...(name.trim() ? { customerName: name.trim() } : {}),
        ...(email.trim() ? { customerEmail: email.trim() } : {}),
        customerPhone: phone.trim(),
        call: {
          direction: typeMeta.direction,
          duration: 0,
        },
      };

      const result = await createTicket(payload);
      const ticket = result?.data?.ticket;
      const ticketId = ticket?.ticketId || ticket?.id;
      localStorage.removeItem(DRAFT_KEY);
      navigate(
        ticketId
          ? `/tickets/calls?ticket=${encodeURIComponent(ticketId)}`
          : "/tickets/calls",
        {
          replace: true,
          state: {
            notice: ticketId
              ? `Call ticket ${ticketId} created`
              : "Call ticket created",
          },
        }
      );
    } catch (err) {
      setError(err.message || "Unable to log call");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ch-page ch-form-page ch-form-page--wide">
      <header className="ch-form-head">
        <h1>Log phone call</h1>
        <p>Create a ticket for an incoming or an outgoing phone call</p>
      </header>

      {error ? <p className="ch-alert ch-alert--error">{error}</p> : null}
      {notice ? <p className="ch-alert ch-alert--info">{notice}</p> : null}

      <form onSubmit={isOutgoing ? handlePlaceCall : handleSubmit}>
        <section className="ch-panel ch-call-type" aria-label="Call type">
          <div className="ch-call-type__icon" aria-hidden="true">
            <Phone size={22} />
          </div>
          <div className="ch-call-type__options">
            {CALL_TYPES.map((option) => (
              <label key={option.value} className="ch-radio">
                <input
                  type="radio"
                  name="call-type"
                  value={option.value}
                  checked={callType === option.value}
                  onChange={() => setCallType(option.value)}
                />
                <div>
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="ch-panel" style={{ marginTop: 16 }}>
          <div className="ch-split">
            <div className="ch-split__col">
              <h3>Caller information</h3>
              <div className="ch-field">
                <label htmlFor="call-phone">Phone number</label>
                <div className="ch-input-wrap">
                  <input
                    id="call-phone"
                    className="ch-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    required
                  />
                  <button
                    type="button"
                    className="ch-input-wrap__action"
                    onClick={lookupCustomer}
                    disabled={lookingUp || !phone.trim()}
                  >
                    Look up customer
                  </button>
                </div>
              </div>
              <div className="ch-field">
                <label htmlFor="recent-calls">Recent calls</label>
                <select
                  id="recent-calls"
                  className="ch-select"
                  value={recentSelect}
                  onChange={(e) => onRecentChange(e.target.value)}
                >
                  <option value="">Select a recent call…</option>
                  {recentCalls.map((ticket) => {
                    const id = ticket.ticketId || ticket.id;
                    const label = [
                      ticket.customer?.name || ticket.customer?.phone || id,
                      formatRelative(ticket.updatedAt || ticket.createdAt),
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="ch-split__col">
              <h3>Customer details</h3>
              <div className="ch-field">
                <label htmlFor="customer-search" className="sr-only">
                  Search customers
                </label>
                <div className="ch-inbox__search" style={{ marginBottom: 12 }}>
                  <Search size={16} aria-hidden="true" />
                  <input
                    id="customer-search"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search Tickets, Customers"
                  />
                </div>
                {searchMatches.length ? (
                  <ul className="ch-suggest" style={{ marginBottom: 12 }}>
                    {searchMatches.map((customer) => (
                      <li key={customer.key}>
                        <button
                          type="button"
                          onClick={() => applyCustomer(customer)}
                        >
                          <div>
                            <strong>{customer.name}</strong>
                            <span>
                              {[customer.email, customer.phone]
                                .filter(Boolean)
                                .join(" · ") || "No contact"}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="ch-grid-2">
                <div className="ch-field">
                  <label htmlFor="cust-name">Name</label>
                  <input
                    id="cust-name"
                    className="ch-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Customer name"
                  />
                </div>
                <div className="ch-field">
                  <label htmlFor="cust-email">Email</label>
                  <input
                    id="cust-email"
                    type="email"
                    className="ch-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@email.com"
                  />
                </div>
                <div className="ch-field">
                  <label htmlFor="cust-company">Company/organisation</label>
                  <input
                    id="cust-company"
                    className="ch-input"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company name"
                  />
                </div>
                <div className="ch-field">
                  <label htmlFor="cust-id">Customer ID</label>
                  <input
                    id="cust-id"
                    className="ch-input"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="CUS-00000"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="ch-footer-bar">
          <div className="ch-footer-bar__left">
            <button
              type="button"
              className="ch-btn ch-btn--ghost"
              onClick={saveDraft}
            >
              Save as draft
            </button>
            <button
              type="button"
              className="ch-btn ch-btn--ghost"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          </div>
          <div className="ch-footer-bar__right">
            {isOutgoing ? (
              <button
                type="submit"
                className="ch-btn ch-btn--call"
                disabled={placing}
              >
                <PhoneCall size={16} aria-hidden="true" />
                {placing ? "Calling…" : "Place call"}
              </button>
            ) : (
              <button
                type="submit"
                className="ch-btn ch-btn--primary"
                disabled={submitting}
              >
                {submitting ? "Logging..." : "Log call"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
