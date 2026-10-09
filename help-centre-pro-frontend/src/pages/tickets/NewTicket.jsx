import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/client.js";
import "../../styles/app.css";
import "../../styles/dashboard.css";

const CHANNELS = [
  { value: "EMAIL", label: "Email" },
  { value: "CHAT", label: "Chat" },
  { value: "PHONE", label: "Call" },
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

export default function NewTicket() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    channel: "EMAIL",
    customerName: "",
    customerEmail: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(key) {
    return (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        channel: form.channel,
        ...(form.customerName.trim() ? { customerName: form.customerName.trim() } : {}),
        ...(form.customerEmail.trim() ? { customerEmail: form.customerEmail.trim() } : {}),
      };

      if (form.channel === "EMAIL") {
        payload.email = {
          subject: form.title.trim(),
          body: form.description.trim(),
          senderType: "CUSTOMER",
          ...(form.customerEmail.trim() ? { fromEmail: form.customerEmail.trim() } : {}),
        };
      } else if (form.channel === "CHAT") {
        payload.chat = {
          message: form.description.trim(),
          senderType: "CUSTOMER",
        };
      } else if (form.channel === "PHONE") {
        payload.call = {
          direction: "INBOUND",
          duration: 0,
        };
      }

      const result = await apiRequest("/tickets", {
        method: "POST",
        auth: true,
        body: payload,
      });

      navigate("/tickets", {
        replace: true,
        state: {
          notice: `Ticket ${result?.data?.ticket?.ticketId || ""} created`,
        },
      });
    } catch (err) {
      setError(err.message || "Unable to create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard__hero">
        <div>
          <h1>New Ticket</h1>
          <p>Create a support ticket for your workspace</p>
        </div>
      </header>

      <section className="dash-panel" style={{ maxWidth: 720 }}>
        <form className="form-grid" onSubmit={handleSubmit}>
          {error ? (
            <p className="dashboard__error full">{error}</p>
          ) : null}

          <div className="field full">
            <label htmlFor="ticket-title">Title</label>
            <input
              id="ticket-title"
              value={form.title}
              onChange={update("title")}
              placeholder="Short summary of the issue"
              required
            />
          </div>

          <div className="field full">
            <label htmlFor="ticket-description">Description</label>
            <input
              id="ticket-description"
              value={form.description}
              onChange={update("description")}
              placeholder="What does the customer need help with?"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="ticket-channel">Channel</label>
            <select id="ticket-channel" value={form.channel} onChange={update("channel")}>
              {CHANNELS.map((channel) => (
                <option key={channel.value} value={channel.value}>
                  {channel.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="ticket-priority">Priority</label>
            <select id="ticket-priority" value={form.priority} onChange={update("priority")}>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="customer-name">Customer name</label>
            <input
              id="customer-name"
              value={form.customerName}
              onChange={update("customerName")}
              placeholder="Optional"
            />
          </div>

          <div className="field">
            <label htmlFor="customer-email">Customer email</label>
            <input
              id="customer-email"
              type="email"
              value={form.customerEmail}
              onChange={update("customerEmail")}
              placeholder="Optional"
            />
          </div>

          <div className="row-actions full" style={{ marginTop: 8 }}>
            <button className="primary-btn" type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Ticket"}
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => navigate("/tickets")}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
