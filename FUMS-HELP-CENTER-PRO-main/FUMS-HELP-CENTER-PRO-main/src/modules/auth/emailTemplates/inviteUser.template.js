import { renderPremiumEmail } from "./emailLayout.js";

export function inviteUserTemplate({
    firstName,
    invitationLink,
    roleName,
    temporaryPassword
}) {
    const safeName = firstName || "there";
    const safeRole = roleName || "Team member";

    return {
        subject: "You're invited to HelpCentre Pro",
        html: renderPremiumEmail({
            preheader: `Join HelpCentre Pro as ${safeRole}.`,
            title: "You're invited",
            greeting: `Hi ${safeName},`,
            bodyHtml: `
              <p style="margin:0 0 12px;">
                You’ve been invited to join <strong style="color:#0B1220;">HelpCentre Pro</strong> as
                <strong style="color:#0B1220;">${safeRole}</strong>.
              </p>
              <p style="margin:0 0 16px;">
                Accept the invitation, then sign in with your temporary password.
              </p>
              <div style="margin:0;padding:14px 16px;border-radius:12px;background:#F8FAFC;border:1px solid #E2E8F0;">
                <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;font-weight:700;margin-bottom:6px;">
                  Temporary password
                </div>
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:15px;color:#0B1220;font-weight:650;">
                  ${temporaryPassword}
                </div>
              </div>
            `,
            ctaLabel: "Accept Invitation",
            ctaHref: invitationLink,
            footerNote: "This invitation expires in 48 hours."
        })
    };
}
