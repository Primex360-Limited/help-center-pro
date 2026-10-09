import { renderPremiumEmail } from "./emailLayout.js";

export default function verifyEmailTemplate({ firstName, verificationLink }) {
    const safeName = firstName || "there";

    return {
        subject: "Verify your HelpCentre Pro email",
        html: renderPremiumEmail({
            preheader: "Confirm your email to activate your HelpCentre Pro account.",
            title: "Verify your email address",
            greeting: `Hi ${safeName},`,
            bodyHtml: `
              <p style="margin:0 0 12px;">
                Welcome to <strong style="color:#0B1220;">HelpCentre Pro</strong>. Confirm this email to unlock your workspace and start delivering unified support.
              </p>
              <p style="margin:0;">
                This secure link expires in <strong style="color:#0B1220;">1 hour</strong>.
              </p>
            `,
            ctaLabel: "Verify Email",
            ctaHref: verificationLink,
            footerNote: "If you did not create this account, you can safely ignore this email."
        })
    };
}
