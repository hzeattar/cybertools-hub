"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BrainCircuit,
  Clipboard,
  Code2,
  FileText,
  Network,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";

type Props = {
  signedIn: boolean;
  pro: boolean;
};

type AiResponse = {
  answer?: string;
  error?: string;
  fallback?: boolean;
  plan?: string;
  providerLabel?: string;
  usage?: { used: number; limit: number };
};

type PromptTemplate = {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string;
};

const templates: PromptTemplate[] = [
  {
    id: "headers",
    label: "Headers",
    icon: ShieldCheck,
    value:
      "Review these response headers for my own app and prioritize fixes:\nContent-Security-Policy: missing\nX-Frame-Options: missing\nAccess-Control-Allow-Origin: *\nSet-Cookie: session=redacted; Secure",
  },
  {
    id: "openapi",
    label: "OpenAPI",
    icon: Network,
    value:
      "Rank this authorized API surface by defensive test priority:\nGET /api/users/{id}\nPOST /api/admin/invites\nGET /api/invoices/{id}/download\nPATCH /api/accounts/{accountId}/billing",
  },
  {
    id: "code",
    label: "Code Review",
    icon: Code2,
    value:
      "Review this defensive code snippet for likely auth or data exposure issues:\napp.get('/api/invoices/:id', requireLogin, async (req, res) => {\n  const invoice = await db.invoice.findUnique({ where: { id: req.params.id } });\n  res.json(invoice);\n});",
  },
  {
    id: "report",
    label: "Report",
    icon: FileText,
    value:
      "Turn this into a professional vulnerability report outline:\nIssue: user can access another invoice by changing the id parameter\nScope: authorized test account only\nEvidence: request and response redacted\nImpact: invoice data exposure",
  },
];

const defaultPrompt = templates[1].value;

export function CyberAiClient({ signedIn, pro }: Props) {
  const [message, setMessage] = useState(defaultPrompt);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("Ready");
  const [provider, setProvider] = useState(pro ? "AI Pro route" : "Free route");
  const [activeTemplate, setActiveTemplate] = useState("openapi");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setStatus("Analyzing defensive context...");
    const response = await fetch("/api/ai/cyber-security", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = (await response.json().catch(() => ({}))) as AiResponse;
    setLoading(false);
    if (!response.ok) {
      setStatus(data.error ?? "Cyber AI request failed.");
      return;
    }
    setAnswer(data.answer ?? "");
    setProvider(data.providerLabel ?? "Cyber AI");
    setStatus(
      `${data.fallback ? "Fallback used" : "Live provider"} - ${data.plan === "pro" ? "AI Pro" : "Free"} usage ${
        data.usage?.used ?? "?"
      }/${data.usage?.limit ?? "?"}`,
    );
  }

  async function copyAnswer() {
    if (!answer) return;
    await navigator.clipboard.writeText(answer);
    setStatus("Analysis copied to clipboard.");
  }

  function applyTemplate(template: PromptTemplate) {
    setActiveTemplate(template.id);
    setMessage(template.value);
    setAnswer("");
    setStatus("Template loaded.");
  }

  return (
    <div className="ai-workbench">
      <section className="ai-console panel">
        <div className="ai-panel-header">
          <div>
            <div className="ai-badge">
              <BrainCircuit size={18} />
              <span>{pro ? "AI Pro analyst" : "Free analyst"}</span>
            </div>
            <h2>Mission Brief</h2>
          </div>
          <span className="tag teal">
            <ShieldCheck size={14} />
            authorized only
          </span>
        </div>

        <div className="ai-template-grid" aria-label="Prompt templates">
          {templates.map((template) => {
            const Icon = template.icon;
            return (
              <button
                className={`prompt-chip ${activeTemplate === template.id ? "active" : ""}`}
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
              >
                <Icon size={16} />
                {template.label}
              </button>
            );
          })}
        </div>

        <div className="field">
          <label>Security question, code, headers, OpenAPI snippet, or report draft</label>
          <textarea className="textarea ai-textarea" value={message} onChange={(event) => setMessage(event.target.value)} />
        </div>

        <div className="button-row">
          <button className="btn primary" type="button" onClick={run} disabled={!signedIn || loading}>
            <Send size={17} />
            {loading ? "Analyzing" : "Run analysis"}
          </button>
          <button className="btn secondary" type="button" onClick={() => setMessage("")}>
            <RotateCcw size={17} />
            Clear
          </button>
        </div>

        {!signedIn ? <p className="status expired">Login is required before using Cyber AI Analyst.</p> : null}
        <div className="ai-status-line">
          <TerminalSquare size={15} />
          <span>{status}</span>
        </div>
      </section>

      <section className="ai-result panel">
        <div className="ai-panel-header">
          <div>
            <div className="ai-badge cyan">
              <Sparkles size={18} />
              <span>{provider}</span>
            </div>
            <h2>Analyst Output</h2>
          </div>
          <button className="btn secondary icon-btn" type="button" onClick={copyAnswer} disabled={!answer}>
            <Clipboard size={17} />
            Copy
          </button>
        </div>
        <pre className="output ai-output">
          {answer || "Cyber AI output will appear here. Prompts are not stored by CyberTools Hub."}
        </pre>
      </section>
    </div>
  );
}
