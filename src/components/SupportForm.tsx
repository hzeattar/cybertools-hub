"use client";

import { FormEvent, useState } from "react";
import { LifeBuoy, Send } from "lucide-react";

export function SupportForm({ email }: { email?: string }) {
  const [supportEmail, setSupportEmail] = useState(email ?? "");
  const [subject, setSubject] = useState("");
  const [orderId, setOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Include order ID and transaction hash when payment is involved.");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("Sending support message...");
    const response = await fetch("/api/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: supportEmail, subject, orderId, message }),
    });
    const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    setLoading(false);
    if (!response.ok) {
      setStatus(data.error ?? "Support message failed.");
      return;
    }
    setSubject("");
    setOrderId("");
    setMessage("");
    setStatus(data.message ?? "Support message received.");
  }

  return (
    <form className="panel support-form" onSubmit={submit}>
      <div className="ai-badge">
        <LifeBuoy size={16} />
        Talk to support
      </div>
      <div className="split">
        <div className="field">
          <label htmlFor="support-email">Email</label>
          <input
            id="support-email"
            className="input"
            type="email"
            value={supportEmail}
            onChange={(event) => setSupportEmail(event.target.value)}
            required
            disabled={Boolean(email)}
          />
        </div>
        <div className="field">
          <label htmlFor="support-order">Order ID optional</label>
          <input
            id="support-order"
            className="input"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder="Order UUID or manual payment reference"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="support-subject">Subject</label>
        <input
          id="support-subject"
          className="input"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Payment approval, download issue, account help..."
          required
        />
      </div>
      <div className="field">
        <label htmlFor="support-message">Message</label>
        <textarea
          id="support-message"
          className="textarea compact-textarea"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Do not send private keys, passwords, or third-party personal data."
          required
        />
      </div>
      <div className="button-row">
        <button className="btn primary" type="submit" disabled={loading}>
          <Send size={16} />
          {loading ? "Sending" : "Send to admin"}
        </button>
        <span className="ai-status-line support-status">{status}</span>
      </div>
    </form>
  );
}
