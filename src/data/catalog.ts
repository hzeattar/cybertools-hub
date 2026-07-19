export type ToolCategory =
  | "headers"
  | "identity"
  | "reporting"
  | "planning"
  | "encoding"
  | "api"
  | "ai";

export type Tool = {
  slug: string;
  name: string;
  category: ToolCategory;
  summary: string;
  description: string;
  keywords: string[];
  inputs: string[];
  faq: { question: string; answer: string }[];
};

export type Product = {
  slug: string;
  name: string;
  kind: "product" | "ai_pro";
  priceUsdt: number;
  image: string;
  summary: string;
  audience: string;
  deliverables: string[];
  seo: string;
};

export type Guide = {
  slug: string;
  title: string;
  summary: string;
  body: string[];
  language: "en" | "ar";
};

export const tools: Tool[] = [
  {
    slug: "jwt-decoder",
    name: "JWT Decoder",
    category: "identity",
    summary: "Decode JWT headers and payloads locally without sending tokens to a server.",
    description:
      "Inspect JSON Web Tokens, spot weak algorithms, stale claims, and dangerous client-side assumptions during authorized security reviews.",
    keywords: ["jwt decoder", "json web token", "bug bounty auth"],
    inputs: ["JWT token"],
    faq: [
      {
        question: "Does CyberTools Hub store decoded JWTs?",
        answer: "No. The decoder runs in the browser and does not send token text to the server.",
      },
      {
        question: "Can this verify signatures?",
        answer: "V1 decodes and highlights claims; signature verification is planned for a later release.",
      },
    ],
  },
  {
    slug: "security-headers-analyzer",
    name: "Security Headers Analyzer",
    category: "headers",
    summary: "Paste HTTP response headers and get a prioritized hardening checklist.",
    description:
      "Review HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, and other browser-facing controls.",
    keywords: ["security headers analyzer", "HSTS checker", "CSP header"],
    inputs: ["Raw response headers"],
    faq: [
      {
        question: "Is this an active scanner?",
        answer: "No. Paste headers you collected from systems you own or are authorized to test.",
      },
      {
        question: "Does a missing header always mean a bug bounty finding?",
        answer: "Usually no. The tool explains risk and reportability so low-impact noise is reduced.",
      },
    ],
  },
  {
    slug: "csp-analyzer",
    name: "CSP Analyzer",
    category: "headers",
    summary: "Break down Content-Security-Policy directives and flag risky sources.",
    description:
      "Turn dense CSP strings into readable findings for unsafe-inline, wildcard sources, missing object-src, frame-ancestors, and report endpoints.",
    keywords: ["CSP analyzer", "content security policy", "unsafe inline"],
    inputs: ["Content-Security-Policy value"],
    faq: [
      {
        question: "Can this prove XSS?",
        answer: "No. It highlights policy weaknesses that need business context and safe validation.",
      },
      {
        question: "Does it support report-only policies?",
        answer: "Yes. Paste the report-only header value and review the same directive breakdown.",
      },
    ],
  },
  {
    slug: "cors-policy-analyzer",
    name: "CORS Policy Analyzer",
    category: "headers",
    summary: "Check CORS combinations for credential and origin exposure risks.",
    description:
      "Model Access-Control-Allow-Origin and credential settings before deciding whether a CORS behavior is reportable.",
    keywords: ["CORS checker", "CORS misconfiguration", "bug bounty CORS"],
    inputs: ["Origin", "Allow-Origin", "Allow-Credentials"],
    faq: [
      {
        question: "Does this send cross-origin requests?",
        answer: "No. It is a policy reasoning tool and does not test third-party targets.",
      },
      {
        question: "When is CORS reportable?",
        answer: "Usually only when sensitive authenticated data can be read by an attacker-controlled origin.",
      },
    ],
  },
  {
    slug: "cookie-flags-checker",
    name: "Cookie Flags Checker",
    category: "headers",
    summary: "Audit Set-Cookie headers for Secure, HttpOnly, SameSite, scope, and lifetime issues.",
    description:
      "Paste Set-Cookie lines and quickly identify weak session handling patterns worth deeper review.",
    keywords: ["cookie flags checker", "samesite", "httponly secure cookie"],
    inputs: ["Set-Cookie headers"],
    faq: [
      {
        question: "Can this classify session impact?",
        answer: "It flags likely weaknesses; impact still depends on cookie purpose and application behavior.",
      },
      {
        question: "Does it support multiple cookies?",
        answer: "Yes. Paste one Set-Cookie header per line.",
      },
    ],
  },
  {
    slug: "cvss-calculator",
    name: "CVSS Calculator",
    category: "reporting",
    summary: "Estimate vulnerability severity with a practical bug bounty framing.",
    description:
      "A compact CVSS-style calculator that pairs score estimates with report language and triage notes.",
    keywords: ["CVSS calculator", "bug bounty severity", "vulnerability impact"],
    inputs: ["Impact and exploitability metrics"],
    faq: [
      {
        question: "Is this official CVSS scoring?",
        answer: "It is a practical approximation for report drafting, not a replacement for a formal CVSS calculator.",
      },
      {
        question: "Why include bounty wording?",
        answer: "Many reports fail because impact is vague. The output nudges toward concrete business impact.",
      },
    ],
  },
  {
    slug: "bug-bounty-report-formatter",
    name: "Bug Bounty Report Formatter",
    category: "reporting",
    summary: "Generate a concise, evidence-first vulnerability report from structured notes.",
    description:
      "Build clean summaries, reproduction steps, impact statements, remediation notes, and redacted proof sections.",
    keywords: ["bug bounty report template", "vulnerability report", "PoC report"],
    inputs: ["Title", "impact", "steps", "evidence"],
    faq: [
      {
        question: "Does it invent impact?",
        answer: "No. It formats your evidence and prompts you to fill impact with facts you can support.",
      },
      {
        question: "Can it redact secrets?",
        answer: "Yes. The formatter masks common token, key, email, and bearer-token patterns.",
      },
    ],
  },
  {
    slug: "scope-checklist-generator",
    name: "Scope Checklist Generator",
    category: "planning",
    summary: "Turn program scope notes into a safe authorization checklist.",
    description:
      "Create a pre-test checklist that separates in-scope assets, out-of-scope rules, rate limits, and evidence boundaries.",
    keywords: ["bug bounty scope checklist", "authorization checklist", "safe testing"],
    inputs: ["Program policy notes"],
    faq: [
      {
        question: "Does this authorize testing?",
        answer: "No. It helps organize rules you already have from an official program policy.",
      },
      {
        question: "What happens if rules are unclear?",
        answer: "The output marks the item as blocked until the program policy or triage team clarifies it.",
      },
    ],
  },
  {
    slug: "idor-matrix-builder",
    name: "IDOR Matrix Builder",
    category: "planning",
    summary: "Map roles, resources, and actions before testing access control safely.",
    description:
      "Produce a structured IDOR test matrix that keeps authorization checks deliberate and evidence-driven.",
    keywords: ["IDOR checklist", "access control testing", "bug bounty IDOR"],
    inputs: ["Roles", "resources", "actions"],
    faq: [
      {
        question: "Does this automate account takeover tests?",
        answer: "No. It only builds a matrix for authorized accounts and permitted assets.",
      },
      {
        question: "Why use a matrix?",
        answer: "It reduces missed combinations and helps explain impact clearly in reports.",
      },
    ],
  },
  {
    slug: "api-endpoint-risk-mapper",
    name: "API Endpoint Risk Mapper",
    category: "api",
    summary: "Classify API routes by likely auth, object, and data exposure risk.",
    description:
      "Paste endpoint lists and get focused review ideas for object IDs, admin verbs, exports, invoices, webhooks, and account state changes.",
    keywords: ["API security checklist", "endpoint risk mapper", "bug bounty API"],
    inputs: ["Endpoint list"],
    faq: [
      {
        question: "Does it call the API?",
        answer: "No. It analyzes route names and methods from text you provide.",
      },
      {
        question: "Can it handle OpenAPI paths?",
        answer: "Yes. Paste paths or method/path pairs; V1 uses text heuristics.",
      },
    ],
  },
  {
    slug: "rate-limit-test-planner",
    name: "Rate Limit Test Planner",
    category: "planning",
    summary: "Plan low-noise rate-limit checks without abusive traffic.",
    description:
      "Generate cautious request plans, stopping conditions, and report notes for login, OTP, invite, and reset flows.",
    keywords: ["rate limit testing", "OTP brute force checklist", "safe bug bounty testing"],
    inputs: ["Flow name and constraints"],
    faq: [
      {
        question: "Will it run requests?",
        answer: "No. It creates a safe plan and intentionally avoids automated traffic generation.",
      },
      {
        question: "Why no brute force tool?",
        answer: "Automated abusive traffic can violate program rules. V1 focuses on bounded planning.",
      },
    ],
  },
  {
    slug: "url-base64-hex-tools",
    name: "URL, Base64, and Hex Tools",
    category: "encoding",
    summary: "Encode, decode, and inspect common payload formats locally.",
    description:
      "Fast local transforms for URL encoding, Base64, Base64URL, and hex, with safe error output.",
    keywords: ["url decoder", "base64 decoder", "hex encoder"],
    inputs: ["Text payload"],
    faq: [
      {
        question: "Are values sent to CyberTools Hub?",
        answer: "No. Transforms run locally in your browser.",
      },
      {
        question: "Does it support Base64URL?",
        answer: "Yes. The output includes regular and URL-safe Base64 forms.",
      },
    ],
  },
  {
    slug: "json-formatter-diff",
    name: "JSON Formatter and Diff",
    category: "encoding",
    summary: "Format JSON and compare two payloads while keeping data client-side.",
    description:
      "Readable JSON formatting plus a simple line diff for API responses, tokens, and configuration documents.",
    keywords: ["json formatter", "json diff", "api response compare"],
    inputs: ["JSON A", "JSON B"],
    faq: [
      {
        question: "Is this a semantic JSON diff?",
        answer: "V1 provides formatted comparison and line-level changes for fast review.",
      },
      {
        question: "Can I paste secrets?",
        answer: "Prefer redacting secrets first. The tool runs locally, but careful handling is still best.",
      },
    ],
  },
  {
    slug: "hash-generator",
    name: "Hash Generator",
    category: "encoding",
    summary: "Generate SHA-256 and SHA-512 hashes locally for evidence notes.",
    description:
      "Create hashes for payloads, sample IDs, or evidence files without sending content to a server.",
    keywords: ["sha256 generator", "sha512 hash", "evidence hash"],
    inputs: ["Text"],
    faq: [
      {
        question: "Can this hash files?",
        answer: "V1 hashes text. File hashing is planned after the checkout and store are live.",
      },
      {
        question: "Is hashing reversible?",
        answer: "No. Hashes are one-way digests, but weak input can still be guessed.",
      },
    ],
  },
  {
    slug: "openapi-risk-analyzer",
    name: "OpenAPI Risk Analyzer",
    category: "api",
    summary: "Paste OpenAPI paths and rank likely auth, object access, and data exposure review targets.",
    description:
      "Turn OpenAPI snippets or method/path lists into a prioritized API security review plan without calling the target service.",
    keywords: ["openapi security analyzer", "api risk mapper", "api security testing"],
    inputs: ["OpenAPI JSON/YAML or endpoint list"],
    faq: [
      {
        question: "Does this scan an API?",
        answer: "No. It only analyzes pasted route text and keeps planning inside authorized testing boundaries.",
      },
      {
        question: "What risks does it flag?",
        answer: "Object authorization, exports, admin verbs, webhooks, account state changes, and sensitive data paths.",
      },
    ],
  },
  {
    slug: "oauth-oidc-config-reviewer",
    name: "OAuth/OIDC Config Reviewer",
    category: "identity",
    summary: "Review OAuth and OIDC settings for redirect, token, scope, and client-type weaknesses.",
    description:
      "Paste provider notes or config snippets and get a cautious checklist for redirect URIs, PKCE, scopes, token lifetime, and client exposure.",
    keywords: ["oauth security checklist", "oidc config reviewer", "pkce review"],
    inputs: ["OAuth/OIDC configuration notes"],
    faq: [
      {
        question: "Can this validate a live provider?",
        answer: "No. It reviews text you paste and does not perform login or token requests.",
      },
      {
        question: "Is this enough for a finding?",
        answer: "No. Use the output as a review checklist and prove impact only within authorization.",
      },
    ],
  },
  {
    slug: "secret-pii-redactor",
    name: "Secret and PII Redactor",
    category: "reporting",
    summary: "Mask tokens, keys, emails, IPs, and common identifiers before sharing evidence.",
    description:
      "Clean report evidence quickly by masking common secrets and personal data patterns while preserving enough context for triage.",
    keywords: ["secret redactor", "pii redaction", "bug bounty evidence"],
    inputs: ["Evidence text"],
    faq: [
      {
        question: "Does this replace careful review?",
        answer: "No. It catches common patterns, but you should manually review sensitive evidence before submission.",
      },
      {
        question: "Is pasted evidence stored?",
        answer: "No. Redaction runs in the browser as a free tool.",
      },
    ],
  },
  {
    slug: "security-txt-generator",
    name: "Security.txt Generator",
    category: "reporting",
    summary: "Generate a clean security.txt draft for vulnerability disclosure programs.",
    description:
      "Create a security.txt file with contact, policy, acknowledgments, preferred languages, and expiry fields.",
    keywords: ["security.txt generator", "vulnerability disclosure", "security contact"],
    inputs: ["Disclosure contact details"],
    faq: [
      {
        question: "Where should security.txt live?",
        answer: "Usually at /.well-known/security.txt and optionally /security.txt.",
      },
      {
        question: "Does it submit anything?",
        answer: "No. It only generates text you can deploy yourself.",
      },
    ],
  },
  {
    slug: "threat-model-mini-builder",
    name: "Threat Model Mini Builder",
    category: "planning",
    summary: "Convert a feature description into assets, trust boundaries, abuse cases, and controls.",
    description:
      "Draft a compact threat model for a feature, API flow, or user journey before implementation or testing.",
    keywords: ["threat model builder", "stride checklist", "security design review"],
    inputs: ["Feature or flow description"],
    faq: [
      {
        question: "Is this a full threat model?",
        answer: "No. It creates a practical starter model for focused review and follow-up discussion.",
      },
      {
        question: "Can bug bounty researchers use it?",
        answer: "Yes, when planning authorized testing from documented features and program scope.",
      },
    ],
  },
  {
    slug: "subdomain-scope-comparator",
    name: "Subdomain Scope Comparator",
    category: "planning",
    summary: "Compare discovered subdomains against in-scope and out-of-scope policy notes.",
    description:
      "Paste discovered hosts and program scope notes to separate likely in-scope candidates from blocked or unclear assets.",
    keywords: ["bug bounty scope checker", "subdomain scope", "program policy"],
    inputs: ["Subdomains", "scope policy"],
    faq: [
      {
        question: "Does this authorize testing?",
        answer: "No. It highlights candidates and marks unclear entries as blocked until official policy confirms them.",
      },
      {
        question: "Does it discover subdomains?",
        answer: "No. It only compares text you provide.",
      },
    ],
  },
];

export const products: Product[] = [
  {
    slug: "bug-bounty-starter-kit",
    name: "Bug Bounty Starter Kit",
    kind: "product",
    priceUsdt: 9.99,
    image: "/images/product-bug-bounty-starter.webp",
    summary: "A compact starter pack for choosing programs, reading scope, and writing first reports.",
    audience: "New security researchers who want clean process without noisy testing.",
    deliverables: [
      "Program selection scorecard",
      "Scope reading worksheet",
      "First 10 safe test ideas",
      "Markdown report template",
    ],
    seo: "Bug bounty starter kit with report templates, scope checklist, and safe testing workflow.",
  },
  {
    slug: "api-security-checklist-pack",
    name: "API Security Checklist Pack",
    kind: "product",
    priceUsdt: 14.99,
    image: "/images/product-api-checklist.webp",
    summary: "API review worksheets for object authorization, exports, webhooks, and account flows.",
    audience: "Researchers and small teams reviewing APIs with limited time.",
    deliverables: [
      "API endpoint risk scorecard",
      "IDOR test matrix spreadsheet",
      "Webhook review checklist",
      "Rate-limit evidence notes",
    ],
    seo: "API security checklist pack for authorized bug bounty and application security testing.",
  },
  {
    slug: "professional-vulnerability-report-templates",
    name: "Professional Vulnerability Report Templates",
    kind: "product",
    priceUsdt: 19.99,
    image: "/images/product-report-templates.webp",
    summary: "High-signal report templates for access control, auth, CORS, headers, and business logic.",
    audience: "Researchers who want reports that triage teams can reproduce quickly.",
    deliverables: [
      "12 Markdown report templates",
      "Impact wording bank",
      "Evidence redaction guide",
      "Remediation language snippets",
    ],
    seo: "Professional vulnerability report templates for bug bounty, pentest, and appsec findings.",
  },
  {
    slug: "full-security-research-bundle",
    name: "Full Security Research Bundle",
    kind: "product",
    priceUsdt: 29.99,
    image: "/images/product-full-bundle.webp",
    summary: "Every V1 digital product bundled with upgrade notes and launch checklists.",
    audience: "Researchers building a repeatable bug bounty workflow.",
    deliverables: [
      "Starter kit",
      "API checklist pack",
      "Report template library",
      "Recon notes and program tracker",
    ],
    seo: "Complete bug bounty research bundle with security checklists, report templates, and trackers.",
  },
  {
    slug: "ai-pro-pass-30-days",
    name: "AI Pro Pass - 30 Days",
    kind: "ai_pro",
    priceUsdt: 19.99,
    image: "/images/product-ai-pro-pass.webp",
    summary: "Unlock higher daily limits and larger context for Cyber AI Analyst for 30 days.",
    audience: "Security researchers who want deeper AI-assisted review without exposing prompts publicly.",
    deliverables: [
      "100 Cyber AI requests per day",
      "Larger prompt context",
      "Defensive security analysis mode",
      "30-day entitlement after verified USDT TRC20 payment",
    ],
    seo: "Cyber security AI assistant pro pass with higher daily limits for authorized security research.",
  },
];

export const guides: Guide[] = [
  {
    slug: "how-to-write-a-bug-bounty-report",
    title: "How to Write a Bug Bounty Report That Gets Reproduced",
    summary: "A practical structure for high-signal vulnerability reports.",
    language: "en",
    body: [
      "A strong report starts with one reproducible claim. Avoid mixing several weak observations into one submission.",
      "Lead with the affected asset, the broken control, and the user-visible impact. Then show exact steps, expected behavior, actual behavior, and evidence.",
      "Redact secrets, keep payloads minimal, and explain why the behavior matters to the business instead of relying on scanner labels.",
    ],
  },
  {
    slug: "safe-cors-review",
    title: "CORS Review Without Noise",
    summary: "When CORS is worth reporting and when it is only hardening advice.",
    language: "en",
    body: [
      "CORS findings need sensitive data exposure, credentialed requests, and an attacker-controlled origin path.",
      "A wildcard on a public endpoint is usually not enough. Test only within program rules and stop before automation becomes abusive.",
      "Capture request and response headers, the origin used, the data exposed, and the victim precondition.",
    ],
  },
  {
    slug: "api-idor-planning",
    title: "Planning IDOR Tests for APIs",
    summary: "Use role/resource/action matrices to reduce missed access-control cases.",
    language: "en",
    body: [
      "Start with legitimate accounts and assets you are allowed to use. List every resource type, action, and role before sending requests.",
      "Look for predictable IDs, exports, invoices, team membership, invitations, and webhook logs. Each case needs evidence that another user can access or modify data.",
      "Stop when program rules say to stop, especially around production data, rate limits, and destructive actions.",
    ],
  },
  {
    slug: "ar-bug-bounty-scope-reading",
    title: "قراءة نطاق برامج Bug Bounty بدون مخاطرة",
    summary: "طريقة عربية مختصرة لتحويل policy البرنامج إلى checklist اختبار آمن.",
    language: "ar",
    body: [
      "ابدأ بالأصول المسموحة فقط، ولا تفترض أن أي subdomain تابع للشركة داخل النطاق.",
      "افصل بين in-scope وout-of-scope وقيود الاختبار قبل أي تجربة. لو نقطة غير واضحة، اعتبرها ممنوعة إلى أن تتأكد من نص البرنامج.",
      "احتفظ بدليل بسيط: الرابط الرسمي للبرنامج، الأصل المختبر، نوع الاختبار، وسبب اعتباره مسموحًا.",
    ],
  },
];

export function getTool(slug: string) {
  return tools.find((tool) => tool.slug === slug);
}

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getGuide(slug: string) {
  return guides.find((guide) => guide.slug === slug);
}

export function featuredTools() {
  return tools.slice(0, 8);
}
