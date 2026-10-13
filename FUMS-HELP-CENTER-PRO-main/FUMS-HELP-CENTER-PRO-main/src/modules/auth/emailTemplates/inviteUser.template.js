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
    roleName
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
              <p style="margin:0;">
                Open the secure link, create your password, and sign in right away.
                No temporary password required.
              </p>
            `,
            ctaLabel: "Accept invitation",
            ctaHref: invitationLink,
            footerNote: "This invitation expires in 48 hours. If you were not expecting this email, you can ignore it."
        })
    };
}
