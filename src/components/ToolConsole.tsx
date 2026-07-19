"use client";

import { useMemo, useState } from "react";
import {
  analyzeCookies,
  analyzeCors,
  analyzeCsp,
  analyzeSecurityHeaders,
  analyzeOpenApiRisk,
  buildIdorMatrix,
  buildRateLimitPlan,
  buildReport,
  buildScopeChecklist,
  buildThreatModelMini,
  calculateCvssLike,
  compareSubdomainScope,
  encodeBundle,
  formatAndDiffJson,
  generateSecurityTxt,
  hashText,
  mapEndpointRisks,
  parseJwt,
  redactSecretsAndPii,
  reviewOauthOidcConfig,
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
  "openapi-risk-analyzer": "GET /api/users/{id}\nPOST /api/admin/invites\nGET /api/invoices/{id}/download\nPOST /api/webhooks/stripe",
  "oauth-oidc-config-reviewer":
    "response_type=code\nredirect_uri=https://app.example.com/callback\nscope=openid profile email offline_access\npublic client: SPA",
  "secret-pii-redactor":
    "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secret\nemail: researcher@example.com\napi_key=sk-example123456789000000",
  "security-txt-generator": "security@example.com\nhttps://example.com/security-policy",
  "threat-model-mini-builder": "A team invite API lets admins invite users by email and assign roles.",
  "subdomain-scope-comparator": "app.example.com\nadmin.example.com\nold.example.net",
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
      case "openapi-risk-analyzer":
        return analyzeOpenApiRisk(primary);
      case "oauth-oidc-config-reviewer":
        return reviewOauthOidcConfig(primary);
      case "secret-pii-redactor":
        return redactSecretsAndPii(primary);
      case "security-txt-generator":
        return generateSecurityTxt(primary);
      case "threat-model-mini-builder":
        return buildThreatModelMini(primary);
      case "subdomain-scope-comparator":
        return compareSubdomainScope(primary, secondary);
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
  if (slug === "openapi-risk-analyzer") return "OpenAPI paths or endpoint list";
  if (slug === "oauth-oidc-config-reviewer") return "OAuth/OIDC notes";
  if (slug === "secret-pii-redactor") return "Evidence text";
  if (slug === "security-txt-generator") return "Contact and policy details";
  if (slug === "threat-model-mini-builder") return "Feature or flow description";
  if (slug === "subdomain-scope-comparator") return "Discovered subdomains";
  return "Input";
}

function secondaryLabel(slug: string) {
  if (slug === "bug-bounty-report-formatter") return "Affected asset";
  if (slug === "idor-matrix-builder") return "Resources";
  if (slug === "rate-limit-test-planner") return "Program constraints";
  if (slug === "json-formatter-diff") return "JSON B";
  if (slug === "subdomain-scope-comparator") return "Official scope policy";
  return "Secondary input";
}

function needsSecondary(slug: string) {
  return [
    "bug-bounty-report-formatter",
    "idor-matrix-builder",
    "rate-limit-test-planner",
    "json-formatter-diff",
    "subdomain-scope-comparator",
  ].includes(slug);
}
