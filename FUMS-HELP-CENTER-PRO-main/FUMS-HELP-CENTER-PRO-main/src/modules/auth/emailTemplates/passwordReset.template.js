import { renderPremiumEmail } from "./emailLayout.js";

export default function passwordResetTemplate({ firstName, resetLink }) {
    const safeName = firstName || "there";

    return {
        subject: "Reset your HelpCentre Pro password",
        html: renderPremiumEmail({
            preheader: "Create a new password for your HelpCentre Pro account.",
            title: "Create a new password",
            greeting: `Hi ${safeName},`,
            bodyHtml: `
              <p style="margin:0 0 12px;">
                We received a request to reset the password for your HelpCentre Pro account.
              </p>
              <p style="margin:0;">
                Click below to choose a new password. This link expires in <strong style="color:#0B1220;">1 hour</strong>.
              </p>
            `,
            ctaLabel: "Reset Password",
            ctaHref: resetLink,
            footerNote: "If you did not request a password reset, you can safely ignore this email. Your password will stay the same."
        })
    };
}
