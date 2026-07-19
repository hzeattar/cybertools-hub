const DEFAULT_AGENTROUTER_BASE_URL = "https://agentrouter.org/v1";
const DEFAULT_AGENTROUTER_MODEL = "gpt-5";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_MISTRAL_BASE_URL = "https://api.mistral.ai/v1";
const DEFAULT_MISTRAL_MODEL = "mistral-small-latest";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-haiku-latest";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_OLLAMA_MODEL = "llama3.1";
const DEFAULT_POLLINATIONS_BASE_URL = "https://text.pollinations.ai/openai";
const DEFAULT_POLLINATIONS_MODEL = "gpt-oss-20b";

export type CyberAiPlan = "free" | "pro";
export type CyberAiProvider =
  | "agentrouter"
  | "openrouter"
  | "groq"
  | "gemini"
  | "mistral"
  | "anthropic"
  | "openai"
  | "custom"
  | "ollama"
  | "pollinations"
  | "local";

export type CyberAiProviderPreference = CyberAiProvider | "auto";

export type CyberAiRequest = {
  message: string;
  plan: CyberAiPlan;
  agentInstruction?: string;
  context?: string;
  providerPreference?: CyberAiProviderPreference;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
};

export type CyberAiResult = {
  answer: string;
  refused: boolean;
  provider: CyberAiProvider | "policy";
  providerLabel: string;
  fallback: boolean;
  attempts: CyberAiProviderAttempt[];
};

export type CyberAiProviderAttempt = {
  provider: CyberAiProvider;
  label: string;
  status: "success" | "skipped" | "failed";
  detail?: string;
};

type ProviderConfig = {
  provider: Exclude<CyberAiProvider, "local">;
  label: string;
  apiKey?: string;
  baseUrl: string;
  model: string;
  headers?: Record<string, string>;
  kind?: "openai-compatible" | "anthropic";
};

const SYSTEM_PROMPT =
  "You are CyberTools AI, a practical assistant inside CyberTools Hub. Help with general reasoning, coding, learning, business planning, writing, and defensive security work. For cyber security, help only with defensive analysis, authorized testing, code/config review, vulnerability reports, threat modeling, and safe planning. Refuse malware, phishing, credential theft, persistence, unauthorized exploitation, or harmful automation. Keep outputs useful, structured, and honest about uncertainty.";

export const aiProviderCatalog: { id: CyberAiProviderPreference; label: string; description: string; noKey?: boolean }[] = [
  { id: "auto", label: "Auto router", description: "Use configured paid/free providers, then no-key cloud, then offline local." },
  { id: "agentrouter", label: "AgentRouter", description: "OpenAI-compatible AgentRouter endpoint." },
  { id: "openrouter", label: "OpenRouter", description: "OpenAI-compatible router with free-tier model support." },
  { id: "groq", label: "Groq", description: "Fast OpenAI-compatible hosted models." },
  { id: "gemini", label: "Gemini", description: "Google Gemini through its OpenAI-compatible endpoint." },
  { id: "mistral", label: "Mistral", description: "Mistral chat models through OpenAI-compatible API." },
  { id: "anthropic", label: "Anthropic", description: "Claude models through Anthropic Messages API." },
  { id: "openai", label: "OpenAI", description: "OpenAI chat completions-compatible endpoint." },
  { id: "custom", label: "Custom endpoint", description: "Any OpenAI-compatible endpoint you configure." },
  { id: "ollama", label: "Ollama", description: "Self-hosted Ollama-compatible endpoint." },
  { id: "pollinations", label: "Free cloud", description: "No-key cloud LLM fallback through Pollinations.", noKey: true },
  { id: "local", label: "Offline local", description: "Deterministic defensive fallback built into the app.", noKey: true },
];

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

export function getProviderOrder(preferredProvider?: CyberAiProviderPreference) {
  const configured =
    process.env.AI_PROVIDER_ORDER ??
    "agentrouter,openrouter,groq,gemini,mistral,anthropic,openai,custom,ollama,pollinations,local";
  const supported = new Set<CyberAiProvider>(["agentrouter", "openrouter", "groq", "local"]);
  for (const provider of [
    "gemini",
    "mistral",
    "anthropic",
    "openai",
    "custom",
    "ollama",
    "pollinations",
  ] satisfies CyberAiProvider[]) {
    supported.add(provider);
  }
  const order = configured
    .split(/[,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is CyberAiProvider => supported.has(item as CyberAiProvider));

  if (process.env.AI_LOCAL_FALLBACK !== "disabled" && !order.includes("local")) {
    order.push("local");
  }

  const normalized = order.length ? order : (["local"] satisfies CyberAiProvider[]);
  if (!preferredProvider || preferredProvider === "auto") return normalized;
  if (!supported.has(preferredProvider)) return normalized;
  return [preferredProvider, ...normalized.filter((provider) => provider !== preferredProvider)];
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

  if (provider === "groq") {
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

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) return null;
    return {
      provider,
      label: "Gemini",
      apiKey,
      baseUrl: (process.env.GEMINI_BASE_URL ?? DEFAULT_GEMINI_BASE_URL).replace(/\/$/, ""),
      model: process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
    };
  }

  if (provider === "mistral") {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) return null;
    return {
      provider,
      label: "Mistral",
      apiKey,
      baseUrl: (process.env.MISTRAL_BASE_URL ?? DEFAULT_MISTRAL_BASE_URL).replace(/\/$/, ""),
      model: process.env.MISTRAL_MODEL ?? DEFAULT_MISTRAL_MODEL,
    };
  }

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    return {
      provider,
      label: "Anthropic",
      apiKey,
      baseUrl: (process.env.ANTHROPIC_BASE_URL ?? DEFAULT_ANTHROPIC_BASE_URL).replace(/\/$/, ""),
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
      kind: "anthropic",
    };
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    return {
      provider,
      label: "OpenAI",
      apiKey,
      baseUrl: (process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL).replace(/\/$/, ""),
      model: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    };
  }

  if (provider === "custom") {
    const apiKey = process.env.AI_CUSTOM_API_KEY;
    const baseUrl = process.env.AI_CUSTOM_BASE_URL;
    const model = process.env.AI_CUSTOM_MODEL;
    if (!baseUrl || !model) return null;
    return {
      provider,
      label: process.env.AI_CUSTOM_LABEL ?? "Custom AI",
      apiKey,
      baseUrl: baseUrl.replace(/\/$/, ""),
      model,
    };
  }

  if (provider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL;
    if (!baseUrl && process.env.OLLAMA_ENABLED !== "true") return null;
    return {
      provider,
      label: "Ollama",
      apiKey: process.env.OLLAMA_API_KEY,
      baseUrl: (baseUrl ?? DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, ""),
      model: process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL,
    };
  }

  if (provider === "pollinations") {
    if (process.env.POLLINATIONS_ENABLED === "disabled") return null;
    return {
      provider,
      label: "Free Cloud",
      apiKey: process.env.POLLINATIONS_API_KEY,
      baseUrl: (process.env.POLLINATIONS_BASE_URL ?? DEFAULT_POLLINATIONS_BASE_URL).replace(/\/$/, ""),
      model: process.env.POLLINATIONS_MODEL ?? DEFAULT_POLLINATIONS_MODEL,
      headers: process.env.POLLINATIONS_REFERRER
        ? {
            "HTTP-Referer": process.env.POLLINATIONS_REFERRER,
          }
        : undefined,
    };
  }

  return null;
}

async function callOpenAiCompatibleProvider(
  config: ProviderConfig,
  input: { message: string; system: string; conversationHistory?: { role: "user" | "assistant"; content: string }[] },
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...config.headers,
  };
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
  const history = input.conversationHistory?.slice(-10) ?? [];

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: input.system,
          },
          ...history,
          {
            role: "user",
            content: input.message,
          },
        ],
        temperature: 0.2,
        stream: false,
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

async function callAnthropicProvider(
  config: ProviderConfig,
  input: { message: string; system: string; conversationHistory?: { role: "user" | "assistant"; content: string }[] },
) {
  if (!config.apiKey) throw new Error(`${config.label} is missing an API key.`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const history = input.conversationHistory?.slice(-10) ?? [];

  try {
    const response = await fetch(`${config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": process.env.ANTHROPIC_VERSION ?? "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1200,
        system: input.system,
        messages: [
          ...history,
          {
            role: "user",
            content: input.message,
          },
        ],
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = parseJsonObject(text) as {
      content?: { type?: string; text?: string }[];
      error?: { message?: string } | string;
      message?: string;
    };

    if (!response.ok) {
      throw new Error(`${config.label} returned ${response.status}${formatProviderDetail(payload)}`);
    }

    const answer = payload.content
      ?.filter((part) => part.type === "text" || part.text)
      .map((part) => part.text)
      .filter(Boolean)
      .join("\n")
      .trim();
    if (!answer) throw new Error(`${config.label} returned an empty response.`);
    return answer;
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
    ? "\nProvider status\n- External AI provider unavailable or not configured. Local fallback engaged.\n"
    : "";

  return [
    "Offline CyberTools Analyst",
    "Mode: built-in deterministic reasoning. It keeps the product usable when external providers have no credits or are unavailable.",
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
      attempts: [],
    };
  }

  const clipped = input.message.slice(0, maxPromptLength(input.plan));
  const system = [SYSTEM_PROMPT, input.agentInstruction, input.context ? `Relevant approved memory and knowledge:\n${input.context}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const localMessage = input.context ? `${input.context}\n\nUser request:\n${clipped}` : clipped;
  const failures: string[] = [];
  const attempts: CyberAiProviderAttempt[] = [];

  for (const provider of getProviderOrder(input.providerPreference)) {
    if (provider === "local") {
      attempts.push({
        provider,
        label: "Offline local",
        status: "success",
        detail: failures.length ? "External providers failed or were skipped." : "Requested local reasoning.",
      });
      return {
        answer: buildLocalCyberAnalysis(localMessage, input.plan, failures),
        refused: false,
        provider: "local",
        providerLabel: "Local Cyber Analyst",
        fallback: failures.length > 0,
        attempts,
      };
    }

    const config = getProviderConfig(provider);
    if (!config) {
      failures.push(`${provider}: not configured`);
      attempts.push({
        provider,
        label: aiProviderCatalog.find((item) => item.id === provider)?.label ?? provider,
        status: "skipped",
        detail: "Not configured",
      });
      continue;
    }

    try {
      const answer =
        config.kind === "anthropic"
          ? await callAnthropicProvider(config, {
              message: clipped,
              system,
              conversationHistory: input.conversationHistory,
            })
          : await callOpenAiCompatibleProvider(config, {
              message: clipped,
              system,
              conversationHistory: input.conversationHistory,
            });
      attempts.push({ provider, label: config.label, status: "success" });
      return {
        answer,
        refused: false,
        provider,
        providerLabel: config.label,
        fallback: failures.length > 0,
        attempts,
      };
    } catch (error) {
      const detail = (error as Error).message;
      failures.push(detail);
      attempts.push({ provider, label: config.label, status: "failed", detail: sanitizeProviderError(detail) });
    }
  }

  throw new Error(`No AI provider succeeded. ${failures.join(" | ")}`);
}

function sanitizeProviderError(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***")
    .slice(0, 180);
}
