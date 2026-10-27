import { useState } from "react";
import { X } from "lucide-react";
import { emailAccountsApi } from "../../api/email-accounts.api.js";
import {
  GoogleLogo,
  OutlookLogo,
  SmtpMailboxLogo,
} from "./EmailProviderLogos.jsx";
import "../../styles/email-settings.css";

const MAILBOX_PRESETS = {
  gmail: {
    label: "Gmail",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false,
    hint: 'In Google Account → Security, enable 2-Step Verification, then create an App Password for "Mail". Use that 16-character password here — not your normal password.',
  },
  outlook: {
    label: "Outlook / Microsoft 365",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
    hint: "Prefer Google/Outlook OAuth from the previous screen when possible. For app passwords: Microsoft Account → Security → App passwords. Use port 587 (STARTTLS).",
  },
  yahoo: {
    label: "Yahoo Mail",
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
    hint: 'In Yahoo Account Security, generate an App Password for "Other app".',
  },
  zoho: {
    label: "Zoho Mail (@zoho.com)",
    imapHost: "imap.zoho.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.zoho.com",
    smtpPort: 465,
    smtpSecure: true,
    hint: "1) Zoho Mail → Settings → Mail Accounts → enable IMAP. 2) accounts.zoho.com → Security → Application-specific Passwords → generate one for Mail. Paste that password here (spaces are OK).",
  },
  zoho_org: {
    label: "Zoho Mail (custom domain)",
    imapHost: "imappro.zoho.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtppro.zoho.com",
    smtpPort: 465,
    smtpSecure: true,
    hint: "Custom domain on Zoho: IMAP imappro.zoho.com:993 + SMTP smtppro.zoho.com:465. Enable IMAP in Zoho Mail settings, then use an Application-specific Password from accounts.zoho.com → Security (not your login password). Free Zoho orgs may need imap.zoho.com instead — we auto-try both.",
  },
  icloud: {
    label: "iCloud Mail",
    imapHost: "imap.mail.me.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpSecure: false,
    hint: "At appleid.apple.com → Sign-In and Security, create an App-Specific Password. Your username is your full iCloud email address.",
  },
  custom: {
    label: "Custom IMAP / SMTP",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    hint: "Enter IMAP/SMTP from your provider. Port 465 = SSL; port 587 = STARTTLS. Always use an app password when available.",
  },
};

function secureFromSmtpPort(port) {
  const p = Number(port);
  if (p === 465) return true;
  if (p === 587 || p === 25 || p === 2525) return false;
  return false;
}

function secureFromImapPort(port) {
  const p = Number(port);
  if (p === 993) return true;
  if (p === 143) return false;
  return true;
}

/**
 * Provider chooser + custom IMAP/SMTP connect modal.
 * Shared by Email Settings and Configuration → Email.
 */
export default function AddEmailAccountModal({
  onClose,
  providers = { gmailOAuth: true, outlookOAuth: true },
  onAddGmail,
  onAddOutlook,
  onConnected,
  titleChoose = "Integrate outgoing email account",
}) {
  const [view, setView] = useState("choose");
  const [presetKey, setPresetKey] = useState("gmail");
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    password: "",
    ...MAILBOX_PRESETS.gmail,
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [testResult, setTestResult] = useState("");

  function pickPreset(key) {
    setPresetKey(key);
    setForm((f) => ({ ...f, ...MAILBOX_PRESETS[key] }));
    setFormError("");
    setTestResult("");
  }

  async function handleConnectMailbox(e) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    setTestResult("");
    const email = form.email.trim();
    // Auth username is always the mailbox address; displayName is a label only.
    const displayName = (form.displayName || email).trim() || email;
    const imapPort = Number(form.imapPort) || 993;
    const smtpPort = Number(form.smtpPort) || 587;
    // Zoho shows app passwords with spaces — strip them before send.
    const password = String(form.password || "")
      .replace(/[\r\n\t]/g, "")
      .replace(/ /g, "")
      .trim();
    const payload = {
      provider: "custom",
      email,
      displayName,
      password,
      imapHost: form.imapHost.trim(),
      imapPort,
      imapSecure: secureFromImapPort(imapPort),
      smtpHost: form.smtpHost.trim(),
      smtpPort,
      smtpSecure: secureFromSmtpPort(smtpPort),
      isDefault: true,
    };
    try {
      let account;
      try {
        const created = await emailAccountsApi.create(payload);
        account = created.data;
      } catch (createErr) {
        if (createErr.status !== 409) throw createErr;
        const list = await emailAccountsApi.list();
        const existing = (list.data || []).find(
          (a) => a.email?.toLowerCase() === payload.email.toLowerCase()
        );
        if (!existing) throw createErr;
        const updated = await emailAccountsApi.update(existing.id, payload);
        account = updated.data || existing;
        setTestResult("Existing mailbox found — credentials updated, re-testing…");
      }
      const [imap, smtp] = await Promise.all([
        emailAccountsApi
          .testImap(account.id)
          .catch((err) => ({ data: { success: false, message: err.message } })),
        emailAccountsApi
          .testSmtp(account.id)
          .catch((err) => ({ data: { success: false, message: err.message } })),
      ]);
      if (imap.data?.success && smtp.data?.success) {
        setTestResult(
          "Mailbox connected and verified — sending and sync are live. Importing your latest mail…"
        );
        try {
          await emailAccountsApi.syncAccount(account.id);
        } catch {
          /* worker will retry */
        }
        setTimeout(onConnected, 800);
      } else if (!imap.data?.success) {
        setFormError(
          imap.data?.message ||
            "IMAP receive failed. Enable IMAP in Zoho, use an app password, and confirm imappro.zoho.com:993 for custom domains."
        );
      } else {
        setFormError(
          smtp.data?.message ||
            "SMTP send failed. Check host/port and app password, then try again."
        );
      }
    } catch (err) {
      setFormError(err.message || "Unable to connect mailbox");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal--email-account">
        <header className="modal__header">
          <h2>{view === "choose" ? titleChoose : "Custom mailbox"}</h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>

        <div className="modal__body">
          {view === "choose" ? (
            <div className="email-provider-options">
              <button
                type="button"
                className="provider-card"
                onClick={onAddGmail}
                disabled={!providers.gmailOAuth}
                title={
                  providers.gmailOAuth
                    ? "Connect with Google"
                    : "Google sign-in is not configured — use Custom mailbox"
                }
                style={
                  !providers.gmailOAuth
                    ? { opacity: 0.55, cursor: "not-allowed" }
                    : undefined
                }
              >
                <div className="provider-card__logo">
                  <GoogleLogo size={48} />
                </div>
                <h3>Google</h3>
              </button>

              <button
                type="button"
                className="provider-card"
                onClick={onAddOutlook}
                disabled={!providers.outlookOAuth}
                title={
                  providers.outlookOAuth
                    ? "Connect with Outlook"
                    : "Microsoft sign-in is not configured — use Custom mailbox"
                }
                style={
                  !providers.outlookOAuth
                    ? { opacity: 0.55, cursor: "not-allowed" }
                    : undefined
                }
              >
                <div className="provider-card__logo">
                  <OutlookLogo size={48} />
                </div>
                <h3>Outlook</h3>
              </button>

              <button
                type="button"
                className="provider-card"
                onClick={() => setView("mailbox")}
              >
                <div className="provider-card__logo">
                  <SmtpMailboxLogo size={56} />
                </div>
                <h3>Custom mail box</h3>
              </button>
            </div>
          ) : (
            <form className="custom-mailbox-form" onSubmit={handleConnectMailbox}>
              <label className="custom-mailbox-form__label" htmlFor="mailbox-type">
                Mailbox type
              </label>
              <select
                id="mailbox-type"
                className="custom-mailbox-form__input"
                value={presetKey}
                onChange={(e) => pickPreset(e.target.value)}
              >
                {Object.entries(MAILBOX_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>

              <label className="custom-mailbox-form__label" htmlFor="mailbox-email">
                Email Address
              </label>
              <input
                id="mailbox-email"
                className="custom-mailbox-form__input"
                type="email"
                required
                placeholder="Email address(e.g.) support@yourcompany.com"
                value={form.email}
                onChange={(e) => {
                  const email = e.target.value;
                  setForm((prev) => {
                    let next = {
                      ...prev,
                      email,
                      displayName:
                        !prev.displayName || prev.displayName === prev.email
                          ? email
                          : prev.displayName,
                    };
                    // Custom domains on Zoho must use imappro / smtppro — never
                    // the personal imap.zoho.com hosts.
                    if (
                      email.includes("@") &&
                      !/@zoho\./i.test(email) &&
                      (presetKey === "zoho" ||
                        presetKey === "zoho_org" ||
                        /zoho/i.test(prev.imapHost || ""))
                    ) {
                      const org = MAILBOX_PRESETS.zoho_org;
                      next = {
                        ...next,
                        imapHost: org.imapHost,
                        imapPort: org.imapPort,
                        imapSecure: org.imapSecure,
                        smtpHost: org.smtpHost,
                        smtpPort: org.smtpPort,
                        smtpSecure: org.smtpSecure,
                      };
                      setPresetKey("zoho_org");
                    }
                    return next;
                  });
                }}
              />
              <p className="custom-mailbox-form__hint">
                {MAILBOX_PRESETS[presetKey].hint}
              </p>

              <label className="custom-mailbox-form__label" htmlFor="mailbox-user">
                Display name
              </label>
              <input
                id="mailbox-user"
                className="custom-mailbox-form__input custom-mailbox-form__input--accent"
                type="text"
                placeholder="Support · Acme"
                value={form.displayName || form.email}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
              />
              <p className="custom-mailbox-form__hint">
                Login uses your email address above. This field is only the friendly From name.
              </p>

              <label className="custom-mailbox-form__label" htmlFor="mailbox-pass">
                {presetKey === "zoho" || presetKey === "zoho_org"
                  ? "App password"
                  : "Password"}
              </label>
              <input
                id="mailbox-pass"
                className="custom-mailbox-form__input custom-mailbox-form__input--accent"
                type="password"
                required
                placeholder="••••••••••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />

              <div className="custom-mailbox-form__hosts">
                <input
                  className="custom-mailbox-form__input"
                  required
                  placeholder="imap.gmail.com"
                  aria-label="IMAP host"
                  value={form.imapHost}
                  onChange={(e) =>
                    setForm({ ...form, imapHost: e.target.value })
                  }
                />
                <input
                  className="custom-mailbox-form__input"
                  required
                  type="number"
                  placeholder="993"
                  aria-label="IMAP port"
                  value={form.imapPort}
                  onChange={(e) => {
                    const imapPort = e.target.value;
                    setForm({
                      ...form,
                      imapPort,
                      imapSecure: secureFromImapPort(imapPort),
                    });
                  }}
                />
                <input
                  className="custom-mailbox-form__input"
                  required
                  placeholder="smtp.gmail.com"
                  aria-label="SMTP host"
                  value={form.smtpHost}
                  onChange={(e) =>
                    setForm({ ...form, smtpHost: e.target.value })
                  }
                />
                <input
                  className="custom-mailbox-form__input"
                  required
                  type="number"
                  placeholder="587"
                  aria-label="SMTP port"
                  value={form.smtpPort}
                  onChange={(e) => {
                    const smtpPort = e.target.value;
                    setForm({
                      ...form,
                      smtpPort,
                      smtpSecure: secureFromSmtpPort(smtpPort),
                    });
                  }}
                />
              </div>

              {formError ? (
                <p className="custom-mailbox-form__error">{formError}</p>
              ) : null}
              {testResult ? (
                <p className="custom-mailbox-form__ok">{testResult}</p>
              ) : null}

              <div className="custom-mailbox-form__actions">
                <button type="button" className="btn btn--ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  {busy ? "Integrating…" : "Integrate"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
