import { Link } from "react-router-dom";
import { FileText, AlertTriangle, CheckCircle, Users, CreditCard, Shield } from "lucide-react";
import "../../styles/legal.css";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "acceptance", label: "Acceptance of Terms" },
  { id: "accounts", label: "Account & Registration" },
  { id: "services", label: "Service Description" },
  { id: "responsibilities", label: "User Responsibilities" },
  { id: "payment", label: "Payment & Billing" },
  { id: "cancellation", label: "Cancellation & Termination" },
  { id: "intellectual", label: "Intellectual Property" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "disclaimer", label: "Disclaimer of Warranties" },
  { id: "limitation", label: "Limitation of Liability" },
  { id: "indemnification", label: "Indemnification" },
  { id: "governing", label: "Governing Law" },
  { id: "changes", label: "Changes to Terms" },
  { id: "contact", label: "Contact Us" },
];

export default function TermsOfService() {
  return (
    <div className="legal">
      <div className="legal__glow" aria-hidden="true" />

      <header className="legal-top">
        <Link to="/" className="legal-brand">
          HelpCentre <span>Pro</span>
        </Link>
        <div className="legal-top__actions">
          <Link to="/login" className="legal-btn legal-btn--primary">
            Sign in
          </Link>
        </div>
      </header>

      <main className="legal-shell">
        <aside className="legal-rail" aria-label="Table of Contents">
          <p className="legal-rail__kicker">Table of Contents</p>
          <nav className="legal-rail__nav">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="legal-content">
          <section className="legal-hero">
            <p className="legal-eyebrow">Terms of Service</p>
            <h1>Terms of Service</h1>
            <p>
              Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="legal-intro">
              These Terms of Service ("Terms") govern your use of Help Centre Pro, a customer support platform provided by Help Centre Pro. By accessing or using our service, you agree to be bound by these Terms.
            </p>
          </section>

          <section className="legal-section" id="overview">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <div>
                <h2>Overview</h2>
                <p>
                  Help Centre Pro provides a comprehensive customer support platform including ticket management, live chat, email integration, automation tools, and related services. These Terms apply to all users of our platform.
                </p>
              </div>
            </div>
            <p>
              Please read these Terms carefully before using Help Centre Pro. If you do not agree to these Terms, you may not use our service.
            </p>
          </section>

          <section className="legal-section" id="acceptance">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <CheckCircle size={18} />
              </span>
              <div>
                <h2>Acceptance of Terms</h2>
                <p>
                  By creating an account, accessing our platform, or using our services, you acknowledge that you have read, understood, and agree to be bound by these Terms.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                If you are using our service on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.
              </li>
              <li>
                If you do not agree with any part of these Terms, you must not use our service.
              </li>
              <li>
                Your continued use of the service after any changes to these Terms constitutes acceptance of the updated Terms.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="accounts">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Users size={18} />
              </span>
              <div>
                <h2>Account & Registration</h2>
                <p>
                  To use certain features of Help Centre Pro, you must register for an account.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Accurate Information:</strong> You must provide accurate, complete, and current information during registration and keep your account information updated.
              </li>
              <li>
                <strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </li>
              <li>
                <strong>Notification:</strong> You must notify us immediately of any unauthorized use of your account or any other breach of security.
              </li>
              <li>
                <strong>One Account:</strong> You may not create multiple accounts without our express permission. Each account is for individual or organizational use as specified during registration.
              </li>
              <li>
                <strong>Account Termination:</strong> We reserve the right to suspend or terminate your account at any time for violation of these Terms or for any other reason at our sole discretion.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="services">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <div>
                <h2>Service Description</h2>
                <p>
                  Help Centre Pro provides the following services, subject to these Terms and our service level agreements.
                </p>
              </div>
            </div>

            <div className="legal-grid">
              <article className="legal-callout">
                <h3>Ticket Management</h3>
                <p>
                  Create, track, and manage customer support tickets across multiple channels including email, live chat, and phone calls.
                </p>
              </article>
              <article className="legal-callout">
                <h3>Live Chat</h3>
                <p>
                  Real-time chat functionality to communicate with customers directly through your website or application.
                </p>
              </article>
              <article className="legal-callout">
                <h3>Email Integration</h3>
                <p>
                  Connect your email accounts to automatically convert customer emails into support tickets.
                </p>
              </article>
              <article className="legal-callout">
                <h3>Automation</h3>
                <p>
                  Create automated workflows for ticket routing, assignment, escalation, and other support processes.
                </p>
              </article>
              <article className="legal-callout">
                <h3>Customer Management</h3>
                <p>
                  Maintain customer profiles, track interaction history, and manage customer relationships.
                </p>
              </article>
              <article className="legal-callout">
                <h3>API Access</h3>
                <p>
                  Programmatic access to our platform through REST APIs for custom integrations and extensions.
                </p>
              </article>
            </div>

            <p className="legal-note">
              We reserve the right to modify, suspend, or discontinue any part of the service at any time without prior notice. We are not liable to you or any third party for any modification, suspension, or discontinuation of the service.
            </p>
          </section>

          <section className="legal-section" id="responsibilities">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h2>User Responsibilities</h2>
                <p>
                  As a user of Help Centre Pro, you agree to the following responsibilities.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Compliance with Laws:</strong> You must comply with all applicable laws and regulations in your use of our service.
              </li>
              <li>
                <strong>Prohibited Uses:</strong> You may not use our service for illegal purposes, to harass others, or to transmit harmful, offensive, or inappropriate content.
              </li>
              <li>
                <strong>Data Accuracy:</strong> You are responsible for ensuring that customer data you collect and process through our service is accurate and obtained with appropriate consent.
              </li>
              <li>
                <strong>Team Management:</strong> If you manage a team, you are responsible for your team members' use of the service and for ensuring they comply with these Terms.
              </li>
              <li>
                <strong>Customer Communication:</strong> You are responsible for all communications with your customers through our platform and must maintain professional and appropriate conduct.
              </li>
              <li>
                <strong>Security:</strong> You must implement appropriate security measures to protect your account and customer data, including using strong passwords and enabling two-factor authentication where available.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="payment">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <CreditCard size={18} />
              </span>
              <div>
                <h2>Payment & Billing</h2>
                <p>
                  Help Centre Pro offers various subscription plans with different features and pricing tiers.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Subscription Fees:</strong> You agree to pay all fees associated with your chosen subscription plan as described on our pricing page.
              </li>
              <li>
                <strong>Billing Cycle:</strong> Fees are billed on a monthly or annual basis, depending on your selected plan. Annual plans may offer discounted rates.
              </li>
              <li>
                <strong>Payment Method:</strong> You must provide valid payment information and authorize us to charge your payment method for all applicable fees.
              </li>
              <li>
                <strong>Automatic Renewal:</strong> Subscriptions automatically renew unless cancelled at least 30 days before the end of the current billing period.
              </li>
              <li>
                <strong>Price Changes:</strong> We may change our pricing at any time with at least 30 days' notice. Price changes will apply to new billing cycles, not current ones.
              </li>
              <li>
                <strong>Taxes:</strong> You are responsible for all applicable taxes related to your use of our service, unless otherwise stated.
              </li>
              <li>
                <strong>Refunds:</strong> Refunds are handled on a case-by-case basis. Please contact our support team for refund requests.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="cancellation">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h2>Cancellation & Termination</h2>
                <p>
                  You may cancel your subscription at any time through your account settings or by contacting our support team.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Cancellation by You:</strong> You may cancel your subscription at any time. Cancellation will take effect at the end of the current billing period.
              </li>
              <li>
                <strong>Data Retention:</strong> Upon cancellation, your data will be retained for a reasonable period (typically 30 days) before being permanently deleted, unless required by law.
              </li>
              <li>
                <strong>Data Export:</strong> Before cancellation, you may export your data through our platform. We are not responsible for data loss if you fail to export before cancellation.
              </li>
              <li>
                <strong>Termination by Us:</strong> We reserve the right to suspend or terminate your account immediately for violation of these Terms, fraudulent activity, or abuse of our service.
              </li>
              <li>
                <strong>No Refund:</strong> Upon termination, you will not receive a refund for any unused portion of your subscription, except as required by law.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="intellectual">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Shield size={18} />
              </span>
              <div>
                <h2>Intellectual Property</h2>
                <p>
                  Help Centre Pro and its original content, features, and functionality are owned by Help Centre Pro and are protected by international copyright, trademark, and other intellectual property laws.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Our Property:</strong> The service, including all software, text, graphics, logos, and designs, is our exclusive property.
              </li>
              <li>
                <strong>Your License:</strong> We grant you a limited, non-exclusive, non-transferable license to use our service for your internal business purposes.
              </li>
              <li>
                <strong>Your Data:</strong> You retain ownership of all data you submit to our platform, including customer information and ticket content. You grant us a license to use, process, and store this data solely to provide the service.
              </li>
              <li>
                <strong>Feedback:</strong> Any feedback or suggestions you provide about our service becomes our property and may be used to improve our services without compensation to you.
              </li>
              <li>
                <strong>Restrictions:</strong> You may not copy, modify, distribute, or create derivative works of our service without our express written permission.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="privacy">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Shield size={18} />
              </span>
              <div>
                <h2>Privacy Policy</h2>
                <p>
                  Your use of Help Centre Pro is also governed by our Privacy Policy, which describes how we collect, use, and protect your information.
                </p>
              </div>
            </div>

            <p>
              By using our service, you agree to the collection and use of information as described in our Privacy Policy. Please review our Privacy Policy carefully.
            </p>

            <p>
              <Link to="/privacy" className="legal-link">View our Privacy Policy</Link>
            </p>
          </section>

          <section className="legal-section" id="disclaimer">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h2>Disclaimer of Warranties</h2>
                <p>
                  Help Centre Pro is provided on an "as is" and "as available" basis without warranties of any kind.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>No Warranty:</strong> We expressly disclaim all warranties, whether express, implied, statutory, or otherwise, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement.
              </li>
              <li>
                <strong>No Guarantee:</strong> We do not guarantee that the service will be uninterrupted, secure, or error-free, or that any defects will be corrected.
              </li>
              <li>
                <strong>Availability:</strong> We do not guarantee that the service will meet your requirements or be available in your location.
              </li>
              <li>
                <strong>Third-Party Services:</strong> We are not responsible for the availability, accuracy, or reliability of third-party services integrated with our platform.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="limitation">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h2>Limitation of Liability</h2>
                <p>
                  To the maximum extent permitted by applicable law, Help Centre Pro shall not be liable for any indirect, incidental, special, consequential, or punitive damages.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Damages Excluded:</strong> We are not liable for lost profits, lost data, business interruption, or other damages arising from your use or inability to use our service.
              </li>
              <li>
                <strong>Liability Cap:</strong> Our total liability to you for all claims under these Terms shall not exceed the amount you paid for the service in the 12 months preceding the claim.
              </li>
              <li>
                <strong>Exceptions:</strong> Some jurisdictions do not allow the exclusion or limitation of liability for consequential damages, so the above limitation may not apply to you.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="indemnification">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Shield size={18} />
              </span>
              <div>
                <h2>Indemnification</h2>
                <p>
                  You agree to indemnify, defend, and hold harmless Help Centre Pro and its affiliates from any claims arising from your use of the service.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Indemnity Scope:</strong> You agree to indemnify us against any claims, damages, losses, liabilities, and expenses (including legal fees) arising from your violation of these Terms or your misuse of the service.
              </li>
              <li>
                <strong>Defense:</strong> We reserve the right to assume the exclusive defense and control of any matter subject to indemnification, at your expense.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="governing">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <div>
                <h2>Governing Law</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Help Centre Pro is established.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Applicable Law:</strong> Any disputes arising from these Terms or your use of the service shall be resolved in accordance with applicable laws.
              </li>
              <li>
                <strong>Jurisdiction:</strong> You consent to the exclusive jurisdiction of the courts in the applicable jurisdiction for resolution of any disputes.
              </li>
              <li>
                <strong>International Users:</strong> If you are accessing our service from outside our primary jurisdiction, you are responsible for compliance with local laws.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="changes">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <div>
                <h2>Changes to Terms</h2>
                <p>
                  We reserve the right to modify these Terms at any time.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Notification:</strong> We will notify you of material changes by posting the updated Terms on our platform and sending you an email notification.
              </li>
              <li>
                <strong>Effective Date:</strong> Updated Terms become effective when posted. Your continued use of the service after changes constitutes acceptance of the new Terms.
              </li>
              <li>
                <strong>Review:</strong> We encourage you to review these Terms periodically to stay informed of any changes.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="contact">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <div>
                <h2>Contact Us</h2>
                <p>
                  If you have questions about these Terms of Service, please contact us.
                </p>
              </div>
            </div>

            <div className="legal-contact">
              <p>
                <strong>Email:</strong> legal@helpcentrepro.com
              </p>
              <p>
                <strong>Website:</strong> https://helpcentre-pro-web.onrender.com
              </p>
              <p>
                We will respond to your inquiries within a reasonable timeframe, typically within 30 business days.
              </p>
            </div>
          </section>

          <section className="legal-cta">
            <div>
              <h2>General Provisions</h2>
              <p>
                These Terms constitute the entire agreement between you and Help Centre Pro regarding your use of the service. If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
              </p>
            </div>
          </section>

          <footer className="legal-foot">
            <span>© {new Date().getFullYear()} Help Centre Pro. All rights reserved.</span>
            <Link to="/privacy">Privacy Policy</Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
