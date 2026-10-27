import { Link } from "react-router-dom";
import { Shield, Eye, Lock, Database, Globe, Mail } from "lucide-react";
import "../../styles/legal.css";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "information", label: "Information We Collect" },
  { id: "usage", label: "How We Use Your Information" },
  { id: "sharing", label: "Information Sharing" },
  { id: "security", label: "Data Security" },
  { id: "rights", label: "Your Rights" },
  { id: "cookies", label: "Cookies & Tracking" },
  { id: "international", label: "International Transfers" },
  { id: "children", label: "Children's Privacy" },
  { id: "contact", label: "Contact Us" },
];

export default function PrivacyPolicy() {
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
            <p className="legal-eyebrow">Privacy Policy</p>
            <h1>Privacy Policy</h1>
            <p>
              Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="legal-intro">
              At Help Centre Pro, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our customer support platform.
            </p>
          </section>

          <section className="legal-section" id="overview">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Globe size={18} />
              </span>
              <div>
                <h2>Overview</h2>
                <p>
                  Help Centre Pro ("we," "our," or "us") is committed to protecting your personal information and respecting your privacy. This policy applies to all users of our platform, including workspace administrators, support agents, and end customers.
                </p>
              </div>
            </div>
            <p>
              By using Help Centre Pro, you agree to the collection and use of information in accordance with this policy. If you disagree with any part of this policy, please do not use our service.
            </p>
          </section>

          <section className="legal-section" id="information">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Database size={18} />
              </span>
              <div>
                <h2>Information We Collect</h2>
                <p>
                  We collect several types of information to provide and improve our services to you.
                </p>
              </div>
            </div>

            <div className="legal-grid">
              <article className="legal-callout">
                <h3>Account Information</h3>
                <p>
                  When you create an account, we collect your name, email address, password (encrypted), and other information you provide during registration.
                </p>
              </article>
              <article className="legal-callout">
                <h3>Workspace Data</h3>
                <p>
                  Information about your workspace, including company name, team member details, customer profiles, ticket history, and communication logs.
                </p>
              </article>
              <article className="legal-callout">
                <h3>Customer Information</h3>
                <p>
                  End customer data submitted through your support channels, including names, email addresses, phone numbers, and support ticket content.
                </p>
              </article>
              <article className="legal-callout">
                <h3>Usage Data</h3>
                <p>
                  Information about how you use our service, including log data, device information, IP address, browser type, and access times.
                </p>
              </article>
            </div>
          </section>

          <section className="legal-section" id="usage">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Eye size={18} />
              </span>
              <div>
                <h2>How We Use Your Information</h2>
                <p>
                  We use the collected information for various purposes to provide and improve our service.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Service Delivery:</strong> To operate, maintain, and provide the features and functionality of Help Centre Pro, including ticket management, live chat, email integration, and automation tools.
              </li>
              <li>
                <strong>Account Management:</strong> To create and manage your account, authenticate your access, and communicate with you about your account.
              </li>
              <li>
                <strong>Security & Fraud Prevention:</strong> To detect, prevent, and address technical issues, fraudulent activity, and security threats.
              </li>
              <li>
                <strong>Analytics & Improvement:</strong> To analyze usage patterns, improve our services, develop new features, and enhance user experience.
              </li>
              <li>
                <strong>Communication:</strong> To send you technical notices, updates, security alerts, and support messages related to your account.
              </li>
              <li>
                <strong>Legal Compliance:</strong> To comply with legal obligations, enforce our terms, and protect our rights and property.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="sharing">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Mail size={18} />
              </span>
              <div>
                <h2>Information Sharing</h2>
                <p>
                  We respect your privacy and do not sell your personal information. We may share your information only in specific circumstances.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>With Your Consent:</strong> We may share your information when you explicitly consent to such sharing.
              </li>
              <li>
                <strong>Service Providers:</strong> We may share information with trusted third-party service providers who assist us in operating our service (e.g., hosting providers, email services, analytics tools). These providers are contractually bound to protect your information.
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with any merger, sale of assets, financing, or acquisition of all or a portion of our business, your information may be transferred.
              </li>
              <li>
                <strong>Legal Requirements:</strong> We may disclose information when required by law, court order, or to protect our rights, property, or safety, or that of our users.
              </li>
              <li>
                <strong>Within Your Workspace:</strong> Account administrators and team members within your workspace may have access to customer data and ticket information based on their assigned permissions.
              </li>
            </ul>
          </section>

          <section className="legal-section" id="security">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Lock size={18} />
              </span>
              <div>
                <h2>Data Security</h2>
                <p>
                  We implement industry-standard security measures to protect your information.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Encryption:</strong> Data is encrypted in transit using TLS/SSL and at rest using industry-standard encryption protocols.
              </li>
              <li>
                <strong>Access Controls:</strong> Strict access controls and authentication mechanisms limit access to your information to authorized personnel only.
              </li>
              <li>
                <strong>Regular Audits:</strong> We conduct regular security reviews and audits to identify and address potential vulnerabilities.
              </li>
              <li>
                <strong>Secure Infrastructure:</strong> Our infrastructure is hosted on secure, compliant cloud platforms with robust physical and network security.
              </li>
            </ul>

            <p className="legal-note">
              While we take reasonable measures to protect your information, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section className="legal-section" id="rights">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Shield size={18} />
              </span>
              <div>
                <h2>Your Rights</h2>
                <p>
                  Depending on your location, you may have certain rights regarding your personal information.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Access:</strong> Request access to the personal information we hold about you.
              </li>
              <li>
                <strong>Correction:</strong> Request correction of inaccurate or incomplete information.
              </li>
              <li>
                <strong>Deletion:</strong> Request deletion of your personal information, subject to certain legal and business requirements.
              </li>
              <li>
                <strong>Portability:</strong> Request transfer of your data to another service provider where technically feasible.
              </li>
              <li>
                <strong>Objection:</strong> Object to processing of your information for certain purposes.
              </li>
              <li>
                <strong>Restriction:</strong> Request restriction of processing of your information.
              </li>
            </ul>

            <p>
              To exercise these rights, please contact us using the information provided below. We will respond to your request in accordance with applicable law.
            </p>
          </section>

          <section className="legal-section" id="cookies">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Globe size={18} />
              </span>
              <div>
                <h2>Cookies & Tracking</h2>
                <p>
                  We use cookies and similar tracking technologies to enhance your experience and analyze usage.
                </p>
              </div>
            </div>

            <ul className="legal-list">
              <li>
                <strong>Essential Cookies:</strong> Required for the basic functionality of our service, such as authentication and security.
              </li>
              <li>
                <strong>Analytics Cookies:</strong> Help us understand how visitors use our service by collecting anonymous usage statistics.
              </li>
              <li>
                <strong>Preference Cookies:</strong> Remember your settings and preferences to improve your experience.
              </li>
            </ul>

            <p>
              You can control cookies through your browser settings. However, disabling certain cookies may affect the functionality of our service.
            </p>
          </section>

          <section className="legal-section" id="international">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Globe size={18} />
              </span>
              <div>
                <h2>International Transfers</h2>
                <p>
                  Your information may be transferred to and processed in countries other than your country of residence.
                </p>
              </div>
            </div>

            <p>
              When we transfer your information internationally, we ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy and applicable data protection laws.
            </p>
          </section>

          <section className="legal-section" id="children">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Shield size={18} />
              </span>
              <div>
                <h2>Children's Privacy</h2>
                <p>
                  Our service is not intended for children under the age of 13.
                </p>
              </div>
            </div>

            <p>
              We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us, and we will delete such information.
            </p>
          </section>

          <section className="legal-section" id="contact">
            <div className="legal-section__head">
              <span className="legal-icon" aria-hidden="true">
                <Mail size={18} />
              </span>
              <div>
                <h2>Contact Us</h2>
                <p>
                  If you have questions about this Privacy Policy or our data practices, please contact us.
                </p>
              </div>
            </div>

            <div className="legal-contact">
              <p>
                <strong>Email:</strong> privacy@helpcentrepro.com
              </p>
              <p>
                <strong>Website:</strong> https://helpcentre-pro-web.onrender.com
              </p>
              <p>
                We will respond to your inquiries within a reasonable timeframe, typically within 30 days.
              </p>
            </div>
          </section>

          <section className="legal-cta">
            <div>
              <h2>Changes to This Policy</h2>
              <p>
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
              <p>
                You are advised to review this Privacy Policy periodically for any changes. Changes become effective when posted on this page.
              </p>
            </div>
          </section>

          <footer className="legal-foot">
            <span>© {new Date().getFullYear()} Help Centre Pro. All rights reserved.</span>
            <Link to="/terms">Terms of Service</Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
