import { Check, Headphones, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import "../../styles/channels.css";

const CARDS = [
  {
    key: "email",
    title: "Email",
    description:
      "Create a ticket via email. Best for detailed inquiries that don't require immediate response.",
    features: [
      "Attach files and screenshot",
      "Rich text formatting",
      "Send to customer's email",
      "Track email delivery",
    ],
    hint: "Non-urgent issues, documentation request",
    cta: "Create email tickets",
    to: "/tickets/new/email",
    tone: "email",
    Icon: Mail,
    Watermark: Mail,
  },
  {
    key: "phone",
    title: "Phone call",
    description:
      "Place a real phone call to any customer number on any network, or log an incoming call.",
    features: [
      "Real PSTN calling (MTN, Airtel & more)",
      "Call recording",
      "Transcript notes",
      "Call duration tracking",
    ],
    hint: "Outbound dialing, complex issues, VIP customers",
    cta: "place or log call",
    to: "/tickets/new/call",
    tone: "phone",
    Icon: Headphones,
    Watermark: Headphones,
  },
  {
    key: "agent",
    title: "Call an agent",
    description:
      "Start a real-time chat conversation. Best for quick questions and immediate support.",
    features: [
      "Real time calling",
      "Reach out an agent",
      "Quick replies",
      "File sharing",
    ],
    hint: "Urgent issues, quick questions",
    cta: "Call an agent",
    to: "/tickets/live-chat",
    tone: "agent",
    Icon: Phone,
    Watermark: Phone,
  },
];

export default function CreateTicketChooser() {
  return (
    <div className="ch-page ch-chooser">
      <header className="ch-chooser__head">
        <h1>Create new ticket</h1>
        <p>Choose how you want to create this ticket.</p>
      </header>

      <div className="ch-chooser__grid">
        {CARDS.map((card) => {
          const Icon = card.Icon;
          const Watermark = card.Watermark;
          return (
            <article key={card.key} className={`ch-card ch-card--${card.tone}`}>
              <Watermark
                className="ch-card__watermark"
                size={180}
                strokeWidth={1.25}
                aria-hidden="true"
              />
              <div className="ch-card__icon" aria-hidden="true">
                <Icon size={22} />
              </div>
              <h2>{card.title}</h2>
              <p className="ch-card__desc">{card.description}</p>
              <ul className="ch-card__list">
                {card.features.map((feature) => (
                  <li key={feature}>
                    <Check
                      className="ch-card__check"
                      size={16}
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <p className="ch-card__hint">{card.hint}</p>
              <Link
                to={card.to}
                className={`ch-card__cta ch-card__cta--${card.tone}`}
              >
                {card.cta}
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
