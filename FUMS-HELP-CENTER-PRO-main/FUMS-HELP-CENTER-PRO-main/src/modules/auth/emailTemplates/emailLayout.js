import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAND_DIR = path.resolve(__dirname, "../../../assets/brand");
const LOGO_LIGHT_PATH = path.join(BRAND_DIR, "logo-light.png");
const LOGO_PATH = path.join(BRAND_DIR, "logo.png");
const LOGO_CONTENT_ID = "helpcentrepro-logo";

export function getBrandLogoAttachment() {
    const filePath = fs.existsSync(LOGO_LIGHT_PATH) ? LOGO_LIGHT_PATH : LOGO_PATH;
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return {
        filename: "helpcentre-pro-logo.png",
        content: fs.readFileSync(filePath),
        contentId: LOGO_CONTENT_ID
    };
}

export function renderPremiumEmail({
    preheader,
    title,
    greeting,
    bodyHtml,
    ctaLabel,
    ctaHref,
    footerNote
}) {
    const year = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#030712;padding:44px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border-radius:28px;overflow:hidden;border:1px solid rgba(148,163,184,0.14);box-shadow:0 34px 100px rgba(0,0,0,0.6);">
          <tr>
            <td align="center" style="background:radial-gradient(circle at 20% 0%,rgba(56,189,248,0.28),transparent 42%),radial-gradient(circle at 86% 8%,rgba(168,85,247,0.30),transparent 40%),linear-gradient(180deg,#070D1C 0%,#0B1220 48%,#070D1C 100%);padding:42px 30px 34px;">
              <img src="cid:${LOGO_CONTENT_ID}" alt="HelpCentre Pro — Unified Support. Happier Customers." width="360" style="display:block;margin:0 auto;width:360px;max-width:92%;height:auto;border:0;outline:none;text-decoration:none;background:transparent;" />
            </td>
          </tr>
          <tr>
            <td style="background:#FFFFFF;padding:40px 36px 32px;">
              <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:linear-gradient(135deg,#EFF6FF,#F5F3FF);color:#1D4ED8;font-size:11px;font-weight:750;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;">
                HelpCentre Pro · Secure
              </div>
              <h1 style="margin:0 0 14px;font-size:30px;line-height:1.18;letter-spacing:-0.04em;color:#0B1220;font-weight:800;">
                ${title}
              </h1>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#334155;">
                ${greeting}
              </p>
              <div style="font-size:15px;line-height:1.7;color:#475569;">
                ${bodyHtml}
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:32px 0 10px;">
                <tr>
                  <td style="border-radius:14px;background:linear-gradient(135deg,#2563EB 0%,#7C3AED 100%);box-shadow:0 14px 34px rgba(37,99,235,0.34);">
                    <a href="${ctaHref}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:750;color:#FFFFFF;text-decoration:none;border-radius:14px;letter-spacing:-0.01em;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#94A3B8;word-break:break-all;">
                Or paste this link into your browser:<br />
                <a href="${ctaHref}" style="color:#2563EB;text-decoration:none;font-weight:600;">${ctaHref}</a>
              </p>
              ${footerNote ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.65;color:#94A3B8;">${footerNote}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="background:#070D1C;padding:22px 32px;text-align:center;">
              <p style="margin:0;font-size:14px;font-weight:750;letter-spacing:-0.02em;color:#F8FAFC;">HelpCentre Pro</p>
              <p style="margin:6px 0 0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#94A3B8;">
                Unified Support. Happier Customers.
              </p>
              <p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#64748B;">
                © ${year} helpcentrepro.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
}
