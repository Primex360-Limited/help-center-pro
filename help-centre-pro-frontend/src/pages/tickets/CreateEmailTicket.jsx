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
import {
  createTicket,
  listTickets,
  replyTicketEmail,
} from "../../api/tickets.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  avatarTone,
  extractCustomersFromTickets,
  initialsFromName,
} from "./channelUtils.js";
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
  const [signature, setSignature] = useState(() => {
    try {
      const saved = localStorage.getItem("hcp.emailSignature");
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return defaultSignature(userName);
  });
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
          .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
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
        const result = await listTickets({ page: 1, limit: 100 });
        if (cancelled) return;
        setCustomers(extractCustomersFromTickets(result?.data?.tickets || []));
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
      if (draft.ccOpen) setCcOpen(true);
      if (draft.bodyHtml && editorRef.current) {
        editorRef.current.innerHTML = draft.bodyHtml;
      }
      setNotice("Draft restored from this browser.");
    } catch {
      /* ignore corrupt draft */
    }
  }, []);

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

  function persistSignature(next) {
    setSignature(next);
    try {
      localStorage.setItem("hcp.emailSignature", next);
    } catch {
      /* ignore */
    }
  }

  function buildHtmlBody(bodyHtml, sig) {
    const sigHtml = String(sig || "")
      .split("\n")
      .map((line) =>
        line.trim() === "---"
          ? '<hr style="border:none;border-top:1px solid #e4e7ec;margin:16px 0;" />'
          : `<div>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br/>"}</div>`
      )
      .join("");
    return `<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#101828;">${bodyHtml}${sigHtml ? `<div style="margin-top:20px;color:#475467;font-size:13px;">${sigHtml}</div>` : ""}</div>`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const bodyHtml = editorRef.current?.innerHTML || "";
    const bodyText = htmlToPlain(bodyHtml);
    const fullBody = [bodyText, signature.trim()].filter(Boolean).join("\n\n");
    const fullHtml = buildHtmlBody(bodyHtml, signature.trim());
    const email = selectedCustomer?.email || toQuery.trim();
    const name = selectedCustomer?.name || "";

    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!bodyText) {
      setError("Message is required.");
      return;
    }
    if (!email || !email.includes("@")) {
      setError("Select or enter a valid customer email.");
      return;
    }
    if (!fromAccountId || !fromEmail.includes("@")) {
      setError(
        "Connect a mailbox in Settings → Configuration, then choose it in From."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: subject.trim(),
        description: fullBody,
        priority: "MEDIUM",
        channel: "EMAIL",
        customerName: name || email,
        customerEmail: email,
        email: {
          subject: subject.trim(),
          body: fullBody,
          fromEmail,
          toEmail: email,
          senderType: "AGENT",
        },
      };

      const result = await createTicket(payload);
      const ticket = result?.data?.ticket;
      const ticketId = ticket?.ticketId || ticket?.id;

      if (!ticketId) {
        throw new Error("Ticket was created without an id.");
      }

      const replyPayload = {
        body: fullBody,
        html: fullHtml,
        toEmail: email,
        subject: subject.trim(),
        emailAccountId: fromAccountId,
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

  const fromDisplay =
    mailboxesLoading
      ? "Loading mailboxes…"
      : noMailbox
        ? "Connect your email in Settings"
        : fromEmail || "Support@company.com";

  return (
    <div className="ch-page ch-email-create">
      <form className="ch-email-create__form" onSubmit={handleSubmit}>
        {error ? <p className="ch-alert ch-alert--error">{error}</p> : null}
        {notice ? <p className="ch-alert ch-alert--info">{notice}</p> : null}

        {/* Card 1 — title + From / To (matches mock) */}
        <section className="ch-email-card">
          <header className="ch-email-card__hero">
            <div className="ch-email-card__hero-icon" aria-hidden="true">
              <Mail size={22} strokeWidth={1.75} />
            </div>
            <div>
              <h1>Create email ticket</h1>
              <p>Send an email to create a new support ticket</p>
            </div>
          </header>

          <div className="ch-field">
            <label htmlFor="email-from">From</label>
            {mailboxesLoading || noMailbox ? (
              <input
                id="email-from"
                className="ch-input"
                value={fromDisplay}
                readOnly
                disabled={mailboxesLoading}
              />
            ) : mailboxes.length === 1 ? (
              <input
                id="email-from"
                className="ch-input"
                value={fromEmail}
                readOnly
              />
            ) : (
              <select
                id="email-from"
                className="ch-select"
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
              <p className="ch-field-hint">
                <Link to="/workspace/settings/configuration" className="ch-link">
                  Connect a mailbox in Settings → Configuration
                </Link>
              </p>
            ) : null}
          </div>

          <div className="ch-field ch-field--to">
            <div className="ch-field__label-row">
              <label htmlFor="email-to">To</label>
              <Link to="/tickets" className="ch-link ch-link--arrow">
                View all customer
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="ch-search-input">
              <Search size={16} aria-hidden="true" />
              <input
                id="email-to"
                className="ch-input"
                value={selectedCustomer ? "" : toQuery}
                onChange={(e) => {
                  setSelectedCustomer(null);
                  setToQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search Customers by name or email..."
                autoComplete="off"
                disabled={Boolean(selectedCustomer)}
              />
            </div>
            {selectedCustomer ? (
              <div className="ch-customer-card">
                <div
                  className={`ch-avatar ch-avatar--${avatarTone(
                    selectedCustomer.email || selectedCustomer.name
                  )}`}
                >
                  {initialsFromName(selectedCustomer.name)}
                </div>
                <div>
                  <strong>{selectedCustomer.name}</strong>
                  <span>{selectedCustomer.email}</span>
                </div>
                <button
                  type="button"
                  className="ch-customer-card__clear"
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
            {showSuggestions && !selectedCustomer && filteredCustomers.length ? (
              <ul className="ch-suggest">
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
                      <div
                        className={`ch-avatar ch-avatar--sm ch-avatar--${avatarTone(
                          customer.email || customer.name
                        )}`}
                      >
                        {initialsFromName(customer.name)}
                      </div>
                      <div>
                        <strong>{customer.name}</strong>
                        <span>{customer.email || "No email"}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        {/* Card 2 — CC / BCC */}
        <section className="ch-email-card ch-email-card--collapse">
          <button
            type="button"
            className="ch-collapse__toggle"
            onClick={() => setCcOpen((v) => !v)}
            aria-expanded={ccOpen}
          >
            CC/BCC(Optional)
            <ChevronDown
              size={18}
              style={{
                transform: ccOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.15s ease",
              }}
            />
          </button>
          {ccOpen ? (
            <div className="ch-collapse__body">
              <div className="ch-field">
                <label htmlFor="email-cc">CC</label>
                <input
                  id="email-cc"
                  className="ch-input"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Add additional recipients..."
                />
              </div>
              <div className="ch-field">
                <label htmlFor="email-bcc">BCC</label>
                <input
                  id="email-bcc"
                  className="ch-input"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="Add hidden recipients..."
                />
              </div>
            </div>
          ) : null}
        </section>

        {/* Card 3 — Subject + Message */}
        <section className="ch-email-card">
          <div className="ch-field">
            <label htmlFor="email-subject">
              Subject<span className="ch-req">*</span>
            </label>
            <input
              id="email-subject"
              className="ch-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of the issue."
              required
            />
          </div>

          <div className="ch-field ch-field--message">
            <label>
              Message<span className="ch-req">*</span>
            </label>
            <div className="ch-editor-shell">
              <div className="ch-toolbar" role="toolbar" aria-label="Formatting">
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
                className="ch-editor"
                contentEditable
                role="textbox"
                aria-multiline="true"
                data-placeholder="Write your message here..."
                suppressContentEditableWarning
              />
            </div>
          </div>
        </section>

        <div className="ch-footer-bar ch-footer-bar--email">
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
            <button
              type="submit"
              className="ch-btn ch-btn--primary"
              disabled={submitting || noMailbox}
            >
              <Send size={16} aria-hidden="true" />
              {submitting ? "Sending..." : "Send Email"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
