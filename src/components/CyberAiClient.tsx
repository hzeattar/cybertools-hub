"use client";

import { useState } from "react";
import { BrainCircuit, Send, ShieldCheck } from "lucide-react";

type Props = {
  signedIn: boolean;
  pro: boolean;
};

export function CyberAiClient({ signedIn, pro }: Props) {
  const [message, setMessage] = useState(
    "Review this endpoint list for authorized API security testing:\nGET /api/users/{id}\nPOST /api/admin/invites\nGET /api/invoices/{id}/download",
  );
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setStatus("");
    const response = await fetch("/api/ai/cyber-security", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      answer?: string;
      error?: string;
      plan?: string;
      usage?: { used: number; limit: number };
    };
    setLoading(false);
    if (!response.ok) {
      setStatus(data.error ?? "Cyber AI request failed.");
      return;
    }
    setAnswer(data.answer ?? "");
    setStatus(`${data.plan === "pro" ? "AI Pro" : "Free"} usage: ${data.usage?.used ?? "?"}/${data.usage?.limit ?? "?"}`);
  }

  return (
    <div className="workspace">
      <section className="panel">
        <div className="ai-badge">
          <BrainCircuit size={18} />
          <span>{pro ? "AI Pro mode" : "Free analyst mode"}</span>
        </div>
        <div className="field">
          <label>Security question, code, headers, OpenAPI snippet, or report draft</label>
          <textarea className="textarea" value={message} onChange={(event) => setMessage(event.target.value)} />
        </div>
        <div className="button-row">
          <button className="btn primary" type="button" onClick={run} disabled={!signedIn || loading}>
            <Send size={17} />
            {loading ? "Analyzing" : "Run Cyber AI"}
          </button>
          <span className="tag teal">
            <ShieldCheck size={14} />
            authorized use only
          </span>
        </div>
        {!signedIn ? <p className="status expired">Login is required before using Cyber AI Analyst.</p> : null}
        {status ? <p className="muted">{status}</p> : null}
      </section>
      <section className="panel">
        <pre className="output">{answer || "Cyber AI output will appear here. Prompts are not stored by CyberTools Hub."}</pre>
      </section>
    </div>
  );
}
