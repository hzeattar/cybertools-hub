"use client";

import { useMemo, useState } from "react";
import {
  analyzeCookies,
  analyzeCors,
  analyzeCsp,
  analyzeSecurityHeaders,
  buildIdorMatrix,
  buildRateLimitPlan,
  buildReport,
  buildScopeChecklist,
  calculateCvssLike,
  encodeBundle,
  formatAndDiffJson,
  hashText,
  mapEndpointRisks,
  parseJwt,
} from "@/lib/tooling";

const samples: Record<string, string> = {
  "jwt-decoder":
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMDAxIiwiaXNzIjoiYXBpIiwiYXVkIjoid2ViIiwiZXhwIjoxODkzNDU2MDAwfQ.signature",
  "security-headers-analyzer":
    "content-type: text/html\nstrict-transport-security: max-age=31536000; includeSubDomains\nreferrer-policy: strict-origin-when-cross-origin",
  "csp-analyzer": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.example; object-src 'none'",
  "cookie-flags-checker": "session=abc123; Path=/; Secure; HttpOnly; SameSite=Lax\nprefs=light; Path=/",
  "scope-checklist-generator":
    "https://app.example.com is in scope\napi.example.com is in scope\nDo not test denial of service\nOut-of-scope: third-party payment provider",
  "api-endpoint-risk-mapper": "GET /api/users/{id}\nPOST /api/admin/invites\nGET /api/invoices/{id}/download",
};

type Props = {
  slug: string;
  name: string;
};

export function ToolConsole({ slug, name }: Props) {
  const [primary, setPrimary] = useState(samples[slug] ?? "");
  const [secondary, setSecondary] = useState("");
  const [origin, setOrigin] = useState("https://researcher.example");
  const [allowOrigin, setAllowOrigin] = useState("https://researcher.example");
  const [credentials, setCredentials] = useState("true");
  const [cvss, setCvss] = useState({ av: "Network", ac: "Low", pr: "None", ui: "None", c: "Low", i: "Low", a: "None" });
  const [hashOutput, setHashOutput] = useState("");

  const output = useMemo(() => {
    switch (slug) {
      case "jwt-decoder":
        return parseJwt(primary);
      case "security-headers-analyzer":
        return analyzeSecurityHeaders(primary);
      case "csp-analyzer":
        return analyzeCsp(primary);
      case "cors-policy-analyzer":
        return analyzeCors(origin, allowOrigin, credentials);
      case "cookie-flags-checker":
        return analyzeCookies(primary);
      case "cvss-calculator":
        return calculateCvssLike(cvss);
      case "bug-bounty-report-formatter":
        return buildReport({
          title: primary || "Broken access control in invoice endpoint",
          asset: secondary || "https://app.example.com/api/invoices/{id}",
          impact: "A user may access another user's invoice metadata.",
          steps: "1. Sign in as user A.\n2. Request an invoice owned by user B.\n3. Observe the response.",
          evidence: "Authorization: Bearer sample-token\nuser@example.com",
          fix: "Check object ownership server-side before returning invoice data.",
        });
      case "scope-checklist-generator":
        return buildScopeChecklist(primary);
      case "idor-matrix-builder":
        return buildIdorMatrix(primary || "user, manager, admin", secondary || "invoice, project", "read, update, delete");
      case "api-endpoint-risk-mapper":
        return mapEndpointRisks(primary);
      case "rate-limit-test-planner":
        return buildRateLimitPlan(primary || "Password reset OTP", secondary || "Program allows low-volume testing only.");
      case "url-base64-hex-tools":
        return encodeBundle(primary);
      case "json-formatter-diff":
        return formatAndDiffJson(primary || "{\"role\":\"user\"}", secondary);
      case "hash-generator":
        return hashOutput || "Type text, then run hash.";
      default:
        return "This tool is being prepared.";
    }
  }, [allowOrigin, credentials, cvss, hashOutput, origin, primary, secondary, slug]);

  async function runHash() {
    setHashOutput(await hashText(primary));
  }

  async function copyOutput() {
    await navigator.clipboard.writeText(output);
  }

  return (
    <div className="workspace">
      <section className="panel" aria-label={`${name} inputs`}>
        {slug === "cors-policy-analyzer" ? (
          <>
            <Field label="Origin">
              <input className="input" value={origin} onChange={(event) => setOrigin(event.target.value)} />
            </Field>
            <Field label="Access-Control-Allow-Origin">
              <input className="input" value={allowOrigin} onChange={(event) => setAllowOrigin(event.target.value)} />
            </Field>
            <Field label="Access-Control-Allow-Credentials">
              <select className="select" value={credentials} onChange={(event) => setCredentials(event.target.value)}>
                <option>true</option>
                <option>false</option>
              </select>
            </Field>
          </>
        ) : slug === "cvss-calculator" ? (
          <div className="split">
            {[
              ["av", "Attack Vector", ["Network", "Adjacent", "Local", "Physical"]],
              ["ac", "Attack Complexity", ["Low", "High"]],
              ["pr", "Privileges Required", ["None", "Low", "High"]],
              ["ui", "User Interaction", ["None", "Required"]],
              ["c", "Confidentiality", ["None", "Low", "High"]],
              ["i", "Integrity", ["None", "Low", "High"]],
              ["a", "Availability", ["None", "Low", "High"]],
            ].map(([key, label, options]) => (
              <Field key={String(key)} label={String(label)}>
                <select
                  className="select"
                  value={cvss[String(key) as keyof typeof cvss]}
                  onChange={(event) => setCvss((current) => ({ ...current, [String(key)]: event.target.value }))}
                >
                  {(options as string[]).map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        ) : (
          <>
            <Field label={primaryLabel(slug)}>
              <textarea className="textarea" value={primary} onChange={(event) => setPrimary(event.target.value)} />
            </Field>
            {needsSecondary(slug) ? (
              <Field label={secondaryLabel(slug)}>
                <textarea className="textarea" value={secondary} onChange={(event) => setSecondary(event.target.value)} />
              </Field>
            ) : null}
          </>
        )}

        <div className="button-row">
          {slug === "hash-generator" ? (
            <button className="btn primary" type="button" onClick={runHash}>
              Run hash
            </button>
          ) : null}
          <button className="btn secondary" type="button" onClick={copyOutput}>
            Copy output
          </button>
        </div>
      </section>
      <section className="panel" aria-label={`${name} output`}>
        <pre className="output">{output}</pre>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function primaryLabel(slug: string) {
  if (slug === "bug-bounty-report-formatter") return "Report title";
  if (slug === "idor-matrix-builder") return "Roles";
  if (slug === "rate-limit-test-planner") return "Flow name";
  if (slug === "json-formatter-diff") return "JSON A";
  return "Input";
}

function secondaryLabel(slug: string) {
  if (slug === "bug-bounty-report-formatter") return "Affected asset";
  if (slug === "idor-matrix-builder") return "Resources";
  if (slug === "rate-limit-test-planner") return "Program constraints";
  if (slug === "json-formatter-diff") return "JSON B";
  return "Secondary input";
}

function needsSecondary(slug: string) {
  return ["bug-bounty-report-formatter", "idor-matrix-builder", "rate-limit-test-planner", "json-formatter-diff"].includes(slug);
}
