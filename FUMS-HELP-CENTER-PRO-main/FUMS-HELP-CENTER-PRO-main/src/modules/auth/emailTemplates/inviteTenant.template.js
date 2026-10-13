import { renderPremiumEmail } from "./emailLayout.js";

export function inviteTenantTemplate({
    firstName,
    workspaceName,
    invitationLink
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
              <p style="margin:0;">
                Open the secure link below, create your own password, and sign in immediately.
                No temporary password required.
              </p>
            `,
            ctaLabel: "Activate workspace",
            ctaHref: invitationLink,
            footerNote: "This invitation expires in 48 hours. If you were not expecting this email, you can ignore it."
        })
    };
}
