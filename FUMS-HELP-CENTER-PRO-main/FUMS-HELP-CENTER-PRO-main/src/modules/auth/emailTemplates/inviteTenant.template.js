import { renderPremiumEmail } from "./emailLayout.js";

export function inviteTenantTemplate({
    firstName,
    workspaceName,
    invitationLink,
    temporaryPassword
}) {
    const safeName = firstName || "there";
    const safeWorkspace = workspaceName || "your workspace";

    return {
        subject: `You're invited to manage ${safeWorkspace} on HelpCentre Pro`,
        html: renderPremiumEmail({
            preheader: `Activate ${safeWorkspace} on HelpCentre Pro.`,
            title: "Your workspace is ready",
            greeting: `Hi ${safeName},`,
            bodyHtml: `
              <p style="margin:0 0 12px;">
                You’ve been invited as the <strong style="color:#0B1220;">Tenant Admin</strong>
                for <strong style="color:#0B1220;">${safeWorkspace}</strong> on HelpCentre Pro.
              </p>
              <p style="margin:0 0 16px;">
                Accept the invitation to activate your workspace, then sign in with the temporary
                password below and set your own secure password.
              </p>
              <div style="margin:0 0 16px;padding:14px 16px;border-radius:12px;background:#F8FAFC;border:1px solid #E2E8F0;">
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
            footerNote: "This invitation expires in 48 hours. If you were not expecting this email, you can ignore it."
        })
    };
}
