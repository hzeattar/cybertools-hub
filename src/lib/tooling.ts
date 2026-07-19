export function parseJwt(token: string) {
  const [header, payload, signature] = token.trim().split(".");
  if (!header || !payload) return "Paste a JWT with header.payload.signature parts.";

  try {
    const decode = (part: string) => JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    const decodedHeader = decode(header);
    const decodedPayload = decode(payload);
    const warnings: string[] = [];

    if (String(decodedHeader.alg).toLowerCase() === "none") warnings.push("Algorithm is none.");
    if (!decodedPayload.exp) warnings.push("Missing exp claim.");
    if (!decodedPayload.aud) warnings.push("Missing aud claim.");
    if (!decodedPayload.iss) warnings.push("Missing iss claim.");

    return JSON.stringify(
      {
        header: decodedHeader,
        payload: decodedPayload,
        signaturePresent: Boolean(signature),
        reviewNotes: warnings.length ? warnings : ["No obvious metadata warning. Verify signature server-side."],
      },
      null,
      2,
    );
  } catch (error) {
    return `JWT decode failed: ${(error as Error).message}`;
  }
}

export function analyzeSecurityHeaders(raw: string) {
  const lower = new Map(
    raw
      .split(/\r?\n/)
      .map((line) => line.split(":"))
      .filter((parts) => parts.length >= 2)
      .map(([name, ...rest]) => [name.trim().toLowerCase(), rest.join(":").trim()]),
  );
  const checks = [
    ["strict-transport-security", "High", "Enforce HTTPS with a long max-age and includeSubDomains when safe."],
    ["content-security-policy", "High", "Restrict script, object, frame, and base URI sources."],
    ["x-frame-options", "Medium", "Prevent clickjacking where frame-ancestors is not already used."],
    ["x-content-type-options", "Medium", "Use nosniff to reduce MIME confusion."],
    ["referrer-policy", "Low", "Limit sensitive URL leakage to third-party sites."],
    ["permissions-policy", "Low", "Disable browser capabilities the application does not need."],
  ];

  return checks
    .map(([header, severity, advice]) => {
      const present = lower.has(header);
      return `${present ? "OK" : "MISSING"} [${severity}] ${header}: ${present ? lower.get(header) : advice}`;
    })
    .join("\n");
}

export function analyzeCsp(raw: string) {
  if (!raw.trim()) return "Paste a Content-Security-Policy header value.";
  const directives = raw
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [name, ...values] = item.split(/\s+/);
      return { name, values };
    });

  const risks: string[] = [];
  const has = (name: string) => directives.some((directive) => directive.name === name);
  const contains = (value: string) => directives.some((directive) => directive.values.includes(value));

  if (contains("'unsafe-inline'")) risks.push("unsafe-inline allows inline script/style execution.");
  if (contains("*")) risks.push("Wildcard source reduces policy value.");
  if (!has("object-src")) risks.push("Missing object-src; set object-src 'none'.");
  if (!has("base-uri")) risks.push("Missing base-uri; set base-uri 'none' or 'self'.");
  if (!has("frame-ancestors")) risks.push("Missing frame-ancestors clickjacking control.");

  return JSON.stringify({ directives, risks: risks.length ? risks : ["No obvious high-risk directive found."] }, null, 2);
}

export function analyzeCors(origin: string, allowOrigin: string, credentials: string) {
  const credentialed = credentials.toLowerCase() === "true";
  const reflected = allowOrigin.trim() === origin.trim() && origin.trim().length > 0;
  const wildcard = allowOrigin.trim() === "*";
  const risks: string[] = [];

  if (credentialed && wildcard) risks.push("Invalid and dangerous intent: wildcard origin with credentials.");
  if (credentialed && reflected) risks.push("Potentially reportable if authenticated sensitive data is readable.");
  if (!credentialed && (wildcard || reflected)) risks.push("Usually low impact unless sensitive unauthenticated data exists.");
  if (!allowOrigin.trim()) risks.push("No Access-Control-Allow-Origin value provided.");

  return risks.join("\n");
}

export function analyzeCookies(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "Paste one Set-Cookie header per line.";

  return lines
    .map((line) => {
      const name = line.split("=")[0];
      const lower = line.toLowerCase();
      const notes = [
        lower.includes("secure") ? "Secure OK" : "Missing Secure",
        lower.includes("httponly") ? "HttpOnly OK" : "Missing HttpOnly",
        lower.includes("samesite") ? "SameSite OK" : "Missing SameSite",
        lower.includes("domain=") ? "Domain scoped" : "Host scoped",
      ];
      return `${name}: ${notes.join("; ")}`;
    })
    .join("\n");
}

export function calculateCvssLike(values: Record<string, string>) {
  const weights: Record<string, Record<string, number>> = {
    av: { Network: 0.85, Adjacent: 0.62, Local: 0.55, Physical: 0.2 },
    ac: { Low: 0.77, High: 0.44 },
    pr: { None: 0.85, Low: 0.62, High: 0.27 },
    ui: { None: 0.85, Required: 0.62 },
    impact: { None: 0, Low: 0.22, High: 0.56 },
  };
  const exploitability =
    8.22 *
    weights.av[values.av] *
    weights.ac[values.ac] *
    weights.pr[values.pr] *
    weights.ui[values.ui];
  const impact = 1 - (1 - weights.impact[values.c]) * (1 - weights.impact[values.i]) * (1 - weights.impact[values.a]);
  const score = Math.min(10, Math.max(0, (exploitability + impact * 6.42) / 1.35));
  const rounded = Math.round(score * 10) / 10;
  const severity = rounded >= 9 ? "Critical" : rounded >= 7 ? "High" : rounded >= 4 ? "Medium" : rounded > 0 ? "Low" : "None";
  return `Estimated score: ${rounded} (${severity})\n\nUse this as drafting help only. Support severity with concrete user, data, or business impact.`;
}

export function redactEvidence(text: string) {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/(api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"'\s]+/gi, "$1=[REDACTED]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email-redacted]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[card-redacted]");
}

export function buildReport(input: {
  title: string;
  asset: string;
  impact: string;
  steps: string;
  evidence: string;
  fix: string;
}) {
  return `# ${input.title || "Vulnerability title"}

## Summary
The issue affects ${input.asset || "the in-scope asset"} and can lead to ${input.impact || "a security impact that should be stated with evidence"}.

## Steps to Reproduce
${input.steps || "1. Add exact, minimal reproduction steps."}

## Evidence
${redactEvidence(input.evidence || "Attach screenshots, request IDs, and redacted HTTP excerpts.")}

## Impact
${input.impact || "Explain who is affected, what data/action is exposed, and the required attacker preconditions."}

## Recommended Remediation
${input.fix || "Enforce server-side authorization and add regression tests for this access path."}
`;
}

export function buildScopeChecklist(policy: string) {
  const lines = policy
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const risky = lines.filter((line) => /out[- ]of[- ]scope|do not|prohibited|forbidden|no\s+/i.test(line));
  const assets = lines.filter((line) => /(https?:\/\/|\.com|api\.|app\.|mobile|android|ios)/i.test(line));
  return [
    "Authorization checklist",
    "",
    `In-scope candidates found: ${assets.length ? assets.join(", ") : "none detected; confirm manually."}`,
    `Blocking rules found: ${risky.length ? risky.join(" | ") : "none detected; still read the full policy."}`,
    "",
    "- Confirm the asset is explicitly in scope.",
    "- Confirm test type is allowed.",
    "- Set a request-rate limit before testing.",
    "- Avoid destructive actions and third-party data.",
    "- Save the policy URL and timestamp in your notes.",
  ].join("\n");
}

export function buildIdorMatrix(roles: string, resources: string, actions: string) {
  const roleList = splitList(roles);
  const resourceList = splitList(resources);
  const actionList = splitList(actions);
  const rows = ["role,resource,action,expected,actual,evidence"];
  for (const role of roleList) {
    for (const resource of resourceList) {
      for (const action of actionList) {
        rows.push(`${role},${resource},${action},deny unless owner/admin,,`);
      }
    }
  }
  return rows.join("\n");
}

export function mapEndpointRisks(raw: string) {
  const routes = splitList(raw);
  return routes
    .map((route) => {
      const tags: string[] = [];
      if (/{?id}?|\/\d+|uuid|user|account|invoice|order/i.test(route)) tags.push("object authorization");
      if (/admin|role|permission|team|invite/i.test(route)) tags.push("privilege boundary");
      if (/export|download|report|csv|pdf/i.test(route)) tags.push("bulk data exposure");
      if (/webhook|callback|redirect/i.test(route)) tags.push("trust boundary");
      if (/delete|patch|put|post/i.test(route)) tags.push("state change");
      return `${route}: ${tags.length ? tags.join(", ") : "baseline auth and input validation"}`;
    })
    .join("\n");
}

export function buildRateLimitPlan(flow: string, constraints: string) {
  return `Flow: ${flow || "login / OTP / reset / invite"}

Safe plan:
- Confirm program allows rate-limit testing.
- Use accounts you own.
- Start with 3 to 5 requests and stop if lockout, captcha, or warning appears.
- Record headers, timestamps, response codes, and request IDs.
- Do not run sustained automation.

Constraints:
${constraints || "Add policy limits, test windows, and forbidden traffic types."}

Report only if impact is concrete: account takeover, OTP guessing, invite abuse, or billing/resource exhaustion.`;
}

export function formatAndDiffJson(a: string, b: string) {
  try {
    const formattedA = JSON.stringify(JSON.parse(a), null, 2);
    if (!b.trim()) return formattedA;
    const formattedB = JSON.stringify(JSON.parse(b), null, 2);
    const aLines = formattedA.split("\n");
    const bLines = formattedB.split("\n");
    const max = Math.max(aLines.length, bLines.length);
    const diff: string[] = [];
    for (let index = 0; index < max; index += 1) {
      if (aLines[index] !== bLines[index]) {
        if (aLines[index]) diff.push(`- ${aLines[index]}`);
        if (bLines[index]) diff.push(`+ ${bLines[index]}`);
      }
    }
    return diff.length ? diff.join("\n") : "No line-level differences after formatting.";
  } catch (error) {
    return `JSON parse failed: ${(error as Error).message}`;
  }
}

export function encodeBundle(input: string) {
  const utf8 = new TextEncoder().encode(input);
  const hex = Array.from(utf8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const base64 = btoa(String.fromCharCode(...utf8));
  return [
    `URL encoded: ${encodeURIComponent(input)}`,
    `URL decoded: ${safeDecode(input)}`,
    `Base64: ${base64}`,
    `Base64URL: ${base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`,
    `Hex: ${hex}`,
  ].join("\n");
}

export async function hashText(input: string) {
  const bytes = new TextEncoder().encode(input);
  const sha256 = await crypto.subtle.digest("SHA-256", bytes);
  const sha512 = await crypto.subtle.digest("SHA-512", bytes);
  const toHex = (buffer: ArrayBuffer) =>
    Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  return `SHA-256: ${toHex(sha256)}\nSHA-512: ${toHex(sha512)}`;
}

export function analyzeOpenApiRisk(raw: string) {
  const routes = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /(^|\s)(get|post|put|patch|delete|head|options)\s+\/|^\/|"\//i.test(line));
  if (!routes.length) return "Paste OpenAPI paths or method/path lines.";

  const ranked = routes.map((route) => {
    const risks: string[] = [];
    if (/\/(users|accounts|customers|invoices|orders|payments|billing)/i.test(route)) risks.push("sensitive object");
    if (/{[^}]*id[^}]*}|\/:id|\/\d+|uuid/i.test(route)) risks.push("IDOR candidate");
    if (/admin|role|permission|invite|team/i.test(route)) risks.push("privilege boundary");
    if (/export|download|csv|pdf|report|backup/i.test(route)) risks.push("bulk data exposure");
    if (/webhook|callback|redirect|return_url/i.test(route)) risks.push("trust boundary");
    if (/post|put|patch|delete/i.test(route)) risks.push("state change");
    const score = risks.length;
    return { route, score, risks: risks.length ? risks : ["baseline auth, validation, and logging"] };
  });

  return ranked
    .sort((a, b) => b.score - a.score)
    .map((item) => `[${item.score}] ${item.route}\n  Review: ${item.risks.join(", ")}`)
    .join("\n\n");
}

export function reviewOauthOidcConfig(raw: string) {
  const lower = raw.toLowerCase();
  const notes: string[] = [];
  if (/http:\/\//i.test(raw)) notes.push("Redirect URIs should use HTTPS except localhost development callbacks.");
  if (/redirect_uri.*\*/i.test(raw) || /wildcard/i.test(raw)) notes.push("Wildcard redirect URIs are high risk.");
  if (!/pkce|code_challenge/i.test(raw)) notes.push("Confirm PKCE is required for public clients.");
  if (/implicit|response_type\s*[:=]\s*token/i.test(raw)) notes.push("Avoid implicit flow for modern browser/mobile apps.");
  if (/offline_access|refresh/i.test(raw)) notes.push("Review refresh-token rotation, lifetime, and revocation.");
  if (/openid/i.test(raw) && !/nonce/i.test(raw)) notes.push("Confirm nonce validation for OIDC flows.");
  if (/client_secret/i.test(raw) && /spa|mobile|public/.test(lower)) notes.push("Public clients must not embed client secrets.");
  if (!raw.trim()) return "Paste OAuth/OIDC provider notes, app settings, or flow parameters.";
  return notes.length ? notes.map((note) => `- ${note}`).join("\n") : "No obvious OAuth/OIDC configuration warning found. Verify redirect allowlists, PKCE, scopes, and token lifetimes manually.";
}

export function redactSecretsAndPii(text: string) {
  if (!text.trim()) return "Paste evidence text to redact.";
  return redactEvidence(text)
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip-redacted]")
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[aws-key-redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, "sk-[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[jwt-redacted]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn-redacted]");
}

export function generateSecurityTxt(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const contact = lines.find((line) => /@|https?:\/\//.test(line)) ?? "mailto:security@example.com";
  const policy = lines.find((line) => /policy|disclosure|bug|bounty/i.test(line)) ?? "https://example.com/security";
  const expires = new Date(Date.now() + 180 * 24 * 60 * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  return [
    `Contact: ${contact.startsWith("http") || contact.startsWith("mailto:") ? contact : `mailto:${contact}`}`,
    `Policy: ${policy}`,
    "Preferred-Languages: en, ar",
    `Expires: ${expires}`,
    "Canonical: https://example.com/.well-known/security.txt",
    "",
    "# Replace example.com values before publishing.",
  ].join("\n");
}

export function buildThreatModelMini(input: string) {
  const text = input.trim();
  if (!text) return "Describe a feature, API flow, or user journey.";
  const assets = extractTerms(text, /(user|account|token|session|invoice|payment|file|admin|api|webhook|email|password)/gi);
  const boundaries = extractTerms(text, /(browser|mobile|api|database|queue|third-party|provider|webhook|admin)/gi);
  return [
    "Mini threat model",
    "",
    `Feature: ${text.slice(0, 220)}`,
    `Assets: ${assets.length ? assets.join(", ") : "users, data, sessions, service availability"}`,
    `Trust boundaries: ${boundaries.length ? boundaries.join(", ") : "client to API, API to database, third-party integrations"}`,
    "",
    "Abuse cases:",
    "- Broken object authorization across users or tenants.",
    "- Replay or tampering of state-changing requests.",
    "- Token leakage through logs, URLs, or third-party callbacks.",
    "- Excessive privilege in admin or support workflows.",
    "",
    "Controls to verify:",
    "- Server-side authorization per object and action.",
    "- CSRF/replay defenses where browser credentials are used.",
    "- Audit logs for sensitive changes.",
    "- Rate limits and alerting for high-risk flows.",
  ].join("\n");
}

export function compareSubdomainScope(subdomains: string, policy: string) {
  const hosts = splitList(subdomains).map((host) => host.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase());
  if (!hosts.length) return "Paste discovered subdomains in the first input.";
  const policyLower = policy.toLowerCase();
  return hosts
    .map((host) => {
      if (!policy.trim()) return `${host}: unclear - paste official scope policy before testing.`;
      if (policyLower.includes(`out-of-scope: ${host}`) || policyLower.includes(`out of scope: ${host}`)) {
        return `${host}: blocked - explicitly out of scope.`;
      }
      if (policyLower.includes(host)) return `${host}: likely in scope - confirm test type and limits.`;
      const base = host.split(".").slice(-2).join(".");
      if (policyLower.includes(`*.${base}`) || policyLower.includes(base)) {
        return `${host}: candidate - wildcard/base domain appears in policy, verify exclusions.`;
      }
      return `${host}: unclear - treat as blocked until official scope confirms it.`;
    })
    .join("\n");
}

function safeDecode(input: string) {
  try {
    return decodeURIComponent(input);
  } catch {
    return "Input is not valid URL-encoded text.";
  }
}

function extractTerms(input: string, pattern: RegExp) {
  return Array.from(new Set((input.match(pattern) ?? []).map((item) => item.toLowerCase()))).slice(0, 8);
}

function splitList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
