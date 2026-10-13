import { renderPremiumEmail } from "./emailLayout.js";

export default function welcomeEmailTemplate({ firstName, signInLink }) {
    const safeName = firstName || "there";

    return {
        subject: "Welcome to HelpCentre Pro",
        html: renderPremiumEmail({
            preheader:
                "Your account is ready. Sign in and start delivering exceptional support.",
            eyebrow: "Welcome · HelpCentre Pro",
            title: "Your account is ready",
            greeting: `Welcome, ${safeName}.`,
            bodyHtml: `
              <p style="margin:0 0 14px;">
                Thank you for joining <strong style="color:#0B1220;">HelpCentre Pro</strong> —
                the platform built for unified support and happier customers.
              </p>
              <p style="margin:0 0 14px;">
                Your account has been created successfully. You can sign in anytime with the
                email and password you chose.
              </p>
              <div style="margin:0 0 4px;padding:16px 18px;border-radius:14px;background:#F8FAFC;border:1px solid #E2E8F0;">
                <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#64748B;font-weight:750;">
                  What you can do next
                </p>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#334155;">
                  · Sign in to your workspace<br />
                  · Invite your team and configure support channels<br />
                  · Deliver faster, clearer customer experiences
                </p>
              </div>
            `,
            ctaLabel: "Sign in to HelpCentre Pro",
            ctaHref: signInLink,
            footerNote:
                "If you did not create this account, please contact support and we will assist you promptly."
        })
    };
}
