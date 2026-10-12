import { renderPremiumEmail } from "./emailLayout.js";

function roleDisplayName(roleName) {
    if (!roleName) return "Team member";
    if (roleName === "Tenant Admin") return "Admin";
    if (roleName === "Tenant Agent") return "Agent";
    if (roleName === "Tenant Supervisor") return "Supervisor";
    return roleName;
}

export function inviteUserTemplate({
    firstName,
    invitationLink,
    roleName,
    temporaryPassword
}) {
    const safeName = firstName || "there";
    const safeRole = roleDisplayName(roleName);

    return {
        subject: `You're invited to HelpCentre Pro as ${safeRole}`,
        html: renderPremiumEmail({
            preheader: `Join your HelpCentre Pro workspace as ${safeRole}.`,
            title: "You're invited to the team",
            greeting: `Hi ${safeName},`,
            bodyHtml: `
              <p style="margin:0 0 12px;">
                You’ve been invited to join <strong style="color:#0B1220;">HelpCentre Pro</strong>
                as <strong style="color:#0B1220;">${safeRole}</strong>.
              </p>
              <p style="margin:0 0 16px;">
                Accept the invitation to activate your account, then sign in with the temporary password below and create your own secure password.
              </p>
              <div style="margin:0 0 16px;padding:14px 16px;border-radius:12px;background:#F8FAFC;border:1px solid #E2E8F0;">
                <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;font-weight:700;margin-bottom:6px;">
                  Temporary password
                </div>
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:15px;color:#0B1220;font-weight:650;">
                  ${temporaryPassword}
                </div>
              </div>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#667085;">
                For your security, change this password immediately after your first sign-in.
              </p>
            `,
            ctaLabel: "Accept Invitation",
            ctaHref: invitationLink,
            footerNote: "This invitation expires in 48 hours. If you were not expecting this email, you can ignore it."
        })
    };
}
