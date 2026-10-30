import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  ChevronDown,
  ChevronRight,
  Italic,
  Link2,
  Mail,
  Redo2,
  Search,
  Send,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { emailAccountsApi } from "../../api/email-accounts.api.js";
import { listCustomers } from "../../api/customers.api.js";
import { createTicket, replyTicketEmail } from "../../api/tickets.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { avatarTone, initialsFromName } from "./channelUtils.js";
import "../../styles/channels.css";

const DRAFT_KEY = "hcp.emailTicket.draft";

function defaultSignature(userName) {
  return `---\nBest regards,\n${userName || "Support agent"}\nSupport team`;
}

function htmlToPlain(html) {
  const el = document.createElement("div");
  el.innerHTML = html || "";
  return (el.innerText || el.textContent || "").trim();
}

export default function CreateEmailTicket() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editorRef = useRef(null);
  const prefilledTo = (searchParams.get("to") || "").trim();
  const prefilledName = (searchParams.get("name") || "").trim();

  const userName =
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Support agent";

  const [mailboxes, setMailboxes] = useState([]);
  const [mailboxesLoading, setMailboxesLoading] = useState(true);
  const [fromAccountId, setFromAccountId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [toQuery, setToQuery] = useState(prefilledTo);
  const [selectedCustomer, setSelectedCustomer] = useState(() =>
    prefilledTo
      ? {
          email: prefilledTo,
          name: prefilledName || prefilledTo.split("@")[0],
          phone: "",
        }
      : null
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ccOpen, setCcOpen] = useState(true);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const signature = useMemo(() => {
    try {
      const saved = localStorage.getItem("hcp.emailSignature");
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return defaultSignature(userName);
  }, [userName]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedMailbox = useMemo(
    () => mailboxes.find((a) => a.id === fromAccountId) || null,
    [mailboxes, fromAccountId]
  );
  const fromEmail = selectedMailbox?.email || "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMailboxesLoading(true);
      try {
        const result = await emailAccountsApi.list();
        if (cancelled) return;
        const list = (result?.data || [])
          .filter((a) => a?.email && a.isActive !== false)
          .sort(
            (a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault))
          );
        setMailboxes(list);
        const preferred =
          list.find((a) => a.isDefault)?.id || list[0]?.id || "";
        setFromAccountId((prev) => {
          if (prev && list.some((a) => a.id === prev)) return prev;
          return preferred;
        });
      } catch {
        if (!cancelled) {
          setMailboxes([]);
          setFromAccountId("");
        }
      } finally {
        if (!cancelled) setMailboxesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await listCustomers();
        if (cancelled) return;
        const rows = result?.data?.customers || [];
        setCustomers(
          rows.map((c, i) => ({
            key: c.key || c.email || c.customerId || `c-${i}`,
            name: c.name || c.email || "Customer",
            email: String(c.email || "").trim().toLowerCase(),
            phone: c.phone || "",
            customerId: c.customerId || "",
            company: c.company || "",
          }))
        );
      } catch {
        if (!cancelled) setCustomers([]);
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
      if (draft.subject) setSubject(draft.subject);
      if (draft.cc) setCc(draft.cc);
      if (draft.bcc) setBcc(draft.bcc);
      if (draft.toQuery) setToQuery(draft.toQuery);
      if (draft.selectedCustomer) setSelectedCustomer(draft.selectedCustomer);
      if (draft.fromAccountId) setFromAccountId(draft.fromAccountId);
      if (draft.ccOpen != null) setCcOpen(Boolean(draft.ccOpen));
      if (draft.bodyHtml && editorRef.current) {
        editorRef.current.innerHTML = draft.bodyHtml;
      }
      setNotice("Draft restored from this browser.");
    } catch {
      /* ignore corrupt draft */
    }
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    const hasContent = Boolean(
      String(editorRef.current.innerHTML || "")
        .replace(/<br\s*\/?>/gi, "")
        .replace(/&nbsp;/gi, " ")
        .trim()
    );
    if (hasContent) return;
    const lines = String(signature || "")
      .split("\n")
      .map((line) => line.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    editorRef.current.innerHTML = `<p><br></p><p>${lines.join("<br>")}</p>`;
  }, [signature]);

  const filteredCustomers = useMemo(() => {
    const q = toQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => {
        const hay = `${c.name} ${c.email}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [customers, toQuery]);

  const exec = useCallback((command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }, []);

  function handleLink() {
    const url = window.prompt("Enter link URL");
    if (!url) return;
    exec("createLink", url);
  }

  function saveDraft() {
    const bodyHtml = editorRef.current?.innerHTML || "";
    const payload = {
      subject,
      cc,
      bcc,
      toQuery,
      selectedCustomer,
      fromAccountId,
      ccOpen,
      bodyHtml,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setNotice("Draft saved locally.");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const bodyHtml = editorRef.current?.innerHTML || "";
    const bodyText = htmlToPlain(bodyHtml);
    const toEmail = (
      selectedCustomer?.email ||
      toQuery ||
      ""
    )
      .trim()
      .toLowerCase();
    const toName =
      selectedCustomer?.name ||
      (toEmail.includes("@") ? toEmail.split("@")[0] : toEmail);

    if (!fromAccountId || !fromEmail) {
      setError(
        "Connect a mailbox in Settings → Configuration before sending."
      );
      return;
    }
    if (!toEmail || !toEmail.includes("@")) {
      setError("Choose a customer or enter a valid email in To.");
      return;
    }
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!bodyText || bodyText === String(signature || "").trim()) {
      setError("Write a message before sending.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const created = await createTicket({
        title: subject.trim(),
        description: bodyText.slice(0, 2000),
        channel: "EMAIL",
        customerEmail: toEmail,
        customerName: toName,
        customerPhone: selectedCustomer?.phone || undefined,
        priority: "MEDIUM",
      });
      const ticketId =
        created?.data?.ticket?.ticketId || created?.data?.ticketId;
      if (!ticketId) throw new Error("Ticket was created without an ID");

      const replyPayload = {
        body: bodyText,
        html: bodyHtml,
        emailAccountId: fromAccountId,
        subject: subject.trim(),
      };
      if (cc.trim()) replyPayload.cc = cc.trim();
      if (bcc.trim()) replyPayload.bcc = bcc.trim();

      await replyTicketEmail(ticketId, replyPayload);

      localStorage.removeItem(DRAFT_KEY);
      navigate(`/tickets/emails?ticket=${encodeURIComponent(ticketId)}`, {
        replace: true,
        state: {
          notice: `Email sent from ${fromEmail} — ticket ${ticketId} created`,
        },
      });
    } catch (err) {
      setError(
        err.message ||
          "Unable to send email. Check your mailbox in Settings → Configuration."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const noMailbox = !mailboxesLoading && mailboxes.length === 0;
  const fromDisplay = mailboxesLoading
    ? "Loading mailboxes…"
    : noMailbox
      ? "Connect your email in Settings"
      : fromEmail || "Support@company.com";

  return (
    <div className="ch-page cet">
      <form className="cet__form" onSubmit={handleSubmit} noValidate>
        {error ? <p className="ch-alert ch-alert--error">{error}</p> : null}
        {notice ? <p className="ch-alert ch-alert--info">{notice}</p> : null}

        {/* Page hero — matches mock header */}
        <header className="cet__hero">
          <div className="cet__hero-icon" aria-hidden="true">
            <Mail size={22} strokeWidth={1.75} />
          </div>
          <div>
            <h1>Create email ticket</h1>
            <p>Send an email to create a new support ticket</p>
          </div>
        </header>

        {/* Card 1 — From / To */}
        <section className="cet-card">
          <div className="cet-from-to">
            <div className="cet-field">
              <label htmlFor="email-from">From</label>
              {mailboxesLoading || noMailbox || mailboxes.length <= 1 ? (
                <input
                  id="email-from"
                  className="cet-input"
                  value={fromDisplay}
                  readOnly
                  disabled={mailboxesLoading}
                />
              ) : (
                <select
                  id="email-from"
                  className="cet-input cet-select"
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  required
                >
                  {mailboxes.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.email}
                    </option>
                  ))}
                </select>
              )}
              {noMailbox ? (
                <p className="cet-hint">
                  <Link to="/workspace/settings/configuration">
                    Connect a mailbox in Settings → Configuration
                  </Link>
                </p>
              ) : null}
            </div>

            <div className="cet-field">
              <div className="cet-field__row">
                <label htmlFor="email-to">To</label>
                <Link to="/customers" className="cet-link">
                  View all customer
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </div>
              <div className="cet-search">
                <Search
                  size={16}
                  className="cet-search__icon"
                  aria-hidden="true"
                />
                <input
                  id="email-to"
                  className="cet-input cet-input--search"
                  value={selectedCustomer ? "" : toQuery}
                  onChange={(e) => {
                    setSelectedCustomer(null);
                    setToQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowSuggestions(false), 150)
                  }
                  placeholder="Search Customers by name or email..."
                  autoComplete="off"
                />
              </div>

              {selectedCustomer ? (
                <div className="cet-customer">
                  <span
                    className={`ch-avatar ch-avatar--${avatarTone(
                      selectedCustomer.email || selectedCustomer.name
                    )}`}
                    aria-hidden="true"
                  >
                    {initialsFromName(selectedCustomer.name)}
                  </span>
                  <div className="cet-customer__meta">
                    <strong>{selectedCustomer.name}</strong>
                    <span>{selectedCustomer.email}</span>
                  </div>
                  <button
                    type="button"
                    className="cet-customer__clear"
                    aria-label="Clear customer"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setToQuery("");
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : null}

              {showSuggestions &&
              !selectedCustomer &&
              filteredCustomers.length ? (
                <ul className="cet-suggest">
                  {filteredCustomers.map((customer) => (
                    <li key={customer.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setToQuery(customer.email || customer.name);
                          setShowSuggestions(false);
                        }}
                      >
                        <span
                          className={`ch-avatar ch-avatar--sm ch-avatar--${avatarTone(
                            customer.email || customer.name
                          )}`}
                        >
                          {initialsFromName(customer.name)}
                        </span>
                        <span className="cet-customer__meta">
                          <strong>{customer.name}</strong>
                          <span>{customer.email || "No email"}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>

        {/* Card 2 — CC / BCC */}
        <section className="cet-card cet-card--collapse">
          <button
            type="button"
            className="cet-collapse-toggle"
            onClick={() => setCcOpen((v) => !v)}
            aria-expanded={ccOpen}
          >
            <span>CC/BCC (Optional)</span>
            <ChevronDown
              size={18}
              className={ccOpen ? "is-open" : ""}
              aria-hidden="true"
            />
          </button>
          {ccOpen ? (
            <div className="cet-cc-grid">
              <div className="cet-field">
                <label htmlFor="email-cc">CC</label>
                <input
                  id="email-cc"
                  className="cet-input"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Add additional recipients..."
                />
              </div>
              <div className="cet-field">
                <label htmlFor="email-bcc">BCC</label>
                <input
                  id="email-bcc"
                  className="cet-input"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="Add hidden recipients..."
                />
              </div>
            </div>
          ) : null}
        </section>

        {/* Card 3 — Email content */}
        <section className="cet-card">
          <h2 className="cet-card__title">Email content</h2>
          <div className="cet-field">
            <label htmlFor="email-subject">
              Subject<span className="cet-req">*</span>
            </label>
            <input
              id="email-subject"
              className="cet-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of the issue"
              required
            />
          </div>

          <div className="cet-field cet-field--message">
            <label>
              Message<span className="cet-req">*</span>
            </label>
            <div className="cet-editor">
              <div className="cet-toolbar" role="toolbar" aria-label="Formatting">
                <button type="button" onClick={() => exec("bold")} title="Bold">
                  <Bold size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => exec("italic")}
                  title="Italic"
                >
                  <Italic size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => exec("underline")}
                  title="Underline"
                >
                  <Underline size={15} />
                </button>
                <button type="button" onClick={handleLink} title="Link">
                  <Link2 size={15} />
                </button>
                <select
                  aria-label="Paragraph style"
                  defaultValue="p"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "p") exec("formatBlock", "p");
                    else exec("formatBlock", value);
                  }}
                >
                  <option value="p">Paragraph</option>
                  <option value="h2">Heading</option>
                  <option value="h3">Subheading</option>
                </select>
                <button type="button" onClick={() => exec("undo")} title="Undo">
                  <Undo2 size={15} />
                </button>
                <button type="button" onClick={() => exec("redo")} title="Redo">
                  <Redo2 size={15} />
                </button>
              </div>
              <div
                ref={editorRef}
                className="cet-editor__body"
                contentEditable
                role="textbox"
                aria-multiline="true"
                data-placeholder="Write your message here..."
                suppressContentEditableWarning
              />
            </div>
          </div>
        </section>

        {/* Footer — white action bar */}
        <div className="cet-footer">
          <div className="cet-footer__left">
            <button
              type="button"
              className="cet-btn cet-btn--ghost"
              onClick={saveDraft}
            >
              Save as draft
            </button>
            <button
              type="button"
              className="cet-btn cet-btn--ghost"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          </div>
          <button
            type="submit"
            className="cet-btn cet-btn--primary"
            disabled={submitting || noMailbox}
          >
            <Send size={16} aria-hidden="true" />
            {submitting ? "Sending..." : "Send Email"}
          </button>
        </div>
      </form>
    </div>
  );
}
