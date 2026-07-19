const DEFAULT_AGENTROUTER_BASE_URL = "https://agentrouter.org/v1";
const DEFAULT_AGENTROUTER_MODEL = "gpt-5";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

export type CyberAiPlan = "free" | "pro";
export type CyberAiProvider = "agentrouter" | "openrouter" | "groq" | "local";

export type CyberAiRequest = {
  message: string;
  plan: CyberAiPlan;
};

export type CyberAiResult = {
  answer: string;
  refused: boolean;
  provider: CyberAiProvider | "policy";
  providerLabel: string;
  fallback: boolean;
};

type ProviderConfig = {
  provider: Exclude<CyberAiProvider, "local">;
  label: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  headers?: Record<string, string>;
};

const SYSTEM_PROMPT =
  "You are Cyber AI Analyst inside CyberTools Hub. Help only with defensive security, authorized testing, code/config review, vulnerability reports, threat modeling, and safe planning. Refuse malware, phishing, credential theft, persistence, unauthorized exploitation, or harmful automation. Keep outputs practical, concise, and evidence-first.";

export function getAiLimit(plan: CyberAiPlan) {
  const key = plan === "pro" ? "AI_PRO_DAILY_LIMIT" : "AI_FREE_DAILY_LIMIT";
  const fallback = plan === "pro" ? 100 : 20;
  const value = Number(process.env[key] ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function maxPromptLength(plan: CyberAiPlan) {
  return plan === "pro" ? 12_000 : 4_000;
}

export function classifyCyberAiSafety(message: string) {
  const normalized = message.toLowerCase();
  const blocked = [
    /steal|exfiltrate|dump\s+password|dump\s+cookie|session\s+hijack/,
    /phishing|fake\s+login|credential\s+harvest|keylogger/,
    /ransomware|worm|botnet|persistence|reverse\s+shell/,
    /bypass\s+2fa|bypass\s+mfa|brute\s+force\s+password/,
    /exploit\s+.*real\s+target|attack\s+.*website|unauthorized/,
  ];
  if (blocked.some((pattern) => pattern.test(normalized))) {
    return {
      allowed: false,
      reason:
        "I can help with defensive analysis, authorized testing plans, and report writing, but I cannot help with credential theft, malware, phishing, persistence, or unauthorized exploitation.",
    };
  }
  return { allowed: true, reason: "" };
}

export function getProviderOrder() {
  const configured = process.env.AI_PROVIDER_ORDER ?? "agentrouter,openrouter,groq,local";
  const supported = new Set<CyberAiProvider>(["agentrouter", "openrouter", "groq", "local"]);
  const order = configured
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is CyberAiProvider => supported.has(item as CyberAiProvider));

  if (process.env.AI_LOCAL_FALLBACK !== "disabled" && !order.includes("local")) {
    order.push("local");
  }

  return order.length ? order : (["local"] satisfies CyberAiProvider[]);
}

function getProviderConfig(provider: Exclude<CyberAiProvider, "local">): ProviderConfig | null {
  if (provider === "agentrouter") {
    const apiKey = process.env.AGENTROUTER_API_KEY ?? process.env.AGENT_ROUTER_TOKEN;
    if (!apiKey) return null;
    return {
      provider,
      label: "AgentRouter",
      apiKey,
      baseUrl: (process.env.AGENTROUTER_BASE_URL ?? DEFAULT_AGENTROUTER_BASE_URL).replace(/\/$/, ""),
      model: process.env.AGENTROUTER_MODEL ?? DEFAULT_AGENTROUTER_MODEL,
    };
  }

  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cybertools-hub.example";
    return {
      provider,
      label: "OpenRouter",
      apiKey,
      baseUrl: (process.env.OPENROUTER_BASE_URL ?? DEFAULT_OPENROUTER_BASE_URL).replace(/\/$/, ""),
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
      headers: {
        "HTTP-Referer": siteUrl,
        "X-Title": "CyberTools Hub",
      },
    };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return {
    provider,
    label: "Groq",
    apiKey,
    baseUrl: (process.env.GROQ_BASE_URL ?? DEFAULT_GROQ_BASE_URL).replace(/\/$/, ""),
    model: process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL,
  };
}

async function callOpenAiCompatibleProvider(config: ProviderConfig, message: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
        ...config.headers,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = parseJsonObject(text) as {
      choices?: { message?: { content?: string }; text?: string }[];
      error?: { message?: string } | string;
      msg?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new Error(`${config.label} returned ${response.status}${formatProviderDetail(payload)}`);
    }

    const answer = payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text;
    if (!answer) throw new Error(`${config.label} returned an empty response.`);
    return answer.trim();
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatProviderDetail(payload: {
  error?: { message?: string } | string;
  msg?: string;
  message?: string;
}) {
  const message =
    typeof payload.error === "string" ? payload.error : (payload.error?.message ?? payload.msg ?? payload.message);
  return message ? `: ${message}` : "";
}

export function buildLocalCyberAnalysis(message: string, plan: CyberAiPlan, failures: string[] = []) {
  const clipped = message.slice(0, maxPromptLength(plan));
  const endpointLines = clipped
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(get|post|put|patch|delete|head|options)\s+/i.test(line))
    .slice(0, plan === "pro" ? 14 : 8);
  const risks = new Set<string>();

  if (/cors|access-control-allow-origin|\*/i.test(clipped)) risks.add("CORS: restrict origins, methods, and credentials handling.");
  if (/csp|content-security-policy/i.test(clipped)) risks.add("CSP: define a policy that limits script sources and report-only rollout.");
  if (/x-frame-options|frame-ancestors|clickjack/i.test(clipped)) risks.add("Clickjacking: use frame-ancestors or X-Frame-Options where compatible.");
  if (/cookie|session|httponly|samesite/i.test(clipped)) risks.add("Cookies: require HttpOnly, Secure, SameSite, and tight session rotation.");
  if (/jwt|token|bearer/i.test(clipped)) risks.add("JWT: verify algorithm pinning, issuer/audience checks, expiry, and key rotation.");
  if (/idor|\/\{id\}|user\/|invoice|tenant|account/i.test(clipped)) risks.add("Authorization: test object ownership and tenant boundaries before IDOR claims.");
  if (/rate|limit|brute|otp|login/i.test(clipped)) risks.add("Rate limiting: validate per-account, per-IP, and per-action throttles safely.");
  if (/openapi|swagger|endpoint|api/i.test(clipped)) risks.add("API surface: rank endpoints by identity, state change, sensitive data, and trust boundary.");
  if (/secret|api[_-]?key|private[_-]?key|password/i.test(clipped)) risks.add("Secrets: redact values before sharing evidence and rotate any exposed credential.");

  const riskList = Array.from(risks);
  const endpointSummary = endpointLines.length
    ? endpointLines.map((line) => `- ${line}: check authN, authZ, input validation, rate limits, and audit logging.`).join("\n")
    : "- No endpoint list detected. Paste headers, routes, OpenAPI snippets, or report text for deeper ranking.";
  const priority = riskList.length ? riskList.map((item, index) => `${index + 1}. ${item}`).join("\n") : "1. Confirm the asset is in scope.\n2. Identify authentication, authorization, input, and data exposure risks.\n3. Capture evidence without touching third-party data.";
  const providerNote = failures.length
    ? `\nProvider status\n${failures.slice(0, 3).map((failure) => `- ${failure}`).join("\n")}\n`
    : "";

  return [
    "Cyber AI Local Analyst",
    "Mode: deterministic defensive fallback. No external model was used for this answer.",
    providerNote.trim(),
    "Risk priorities",
    priority,
    "Endpoint triage",
    endpointSummary,
    "Safe validation plan",
    "1. Confirm written authorization, asset scope, and test window.",
    "2. Reproduce only on owned/test accounts and avoid destructive payloads.",
    "3. Capture request/response evidence with sensitive values redacted.",
    "4. Prove impact through authorization boundaries, data sensitivity, or business workflow abuse.",
    "5. Stop and ask the program/owner if scope or impact is ambiguous.",
    "Report-ready wording",
    "A defensible report should include affected asset, exact preconditions, minimal reproduction steps, observed vs expected behavior, impact, evidence, and a remediation recommendation.",
    plan === "pro"
      ? "Pro depth: add a risk matrix with likelihood, impact, exploit constraints, affected roles, and regression tests."
      : "Free depth: upgrade to AI Pro for longer context and deeper prioritization once an external model provider is active.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function callCyberAi(input: CyberAiRequest): Promise<CyberAiResult> {
  const safety = classifyCyberAiSafety(input.message);
  if (!safety.allowed) {
    return {
      answer: safety.reason,
      refused: true,
      provider: "policy",
      providerLabel: "Safety policy",
      fallback: false,
    };
  }

  const clipped = input.message.slice(0, maxPromptLength(input.plan));
  const failures: string[] = [];

  for (const provider of getProviderOrder()) {
    if (provider === "local") {
      return {
        answer: buildLocalCyberAnalysis(clipped, input.plan, failures),
        refused: false,
        provider: "local",
        providerLabel: "Local Cyber Analyst",
        fallback: failures.length > 0,
      };
    }

    const config = getProviderConfig(provider);
    if (!config) {
      failures.push(`${provider}: not configured`);
      continue;
    }

    try {
      const answer = await callOpenAiCompatibleProvider(config, clipped);
      return {
        answer,
        refused: false,
        provider,
        providerLabel: config.label,
        fallback: failures.length > 0,
      };
    } catch (error) {
      failures.push((error as Error).message);
    }
  }

  throw new Error(`No AI provider succeeded. ${failures.join(" | ")}`);
}
