const DEFAULT_BASE_URL = "https://co.agentrouter.org/v1";
const DEFAULT_MODEL = "gpt-5.5";

export type CyberAiPlan = "free" | "pro";

export type CyberAiRequest = {
  message: string;
  plan: CyberAiPlan;
};

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

export async function callCyberAi(input: CyberAiRequest) {
  const safety = classifyCyberAiSafety(input.message);
  if (!safety.allowed) return { answer: safety.reason, refused: true };

  const apiKey = process.env.AGENTROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("AGENTROUTER_API_KEY is not configured.");
  }

  const baseUrl = (process.env.AGENTROUTER_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.AGENTROUTER_MODEL ?? DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const clipped = input.message.slice(0, maxPromptLength(input.plan));

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are Cyber AI Analyst inside CyberTools Hub. Help only with defensive security, authorized testing, code/config review, vulnerability reports, threat modeling, and safe planning. Refuse malware, phishing, credential theft, persistence, unauthorized exploitation, or harmful automation. Keep outputs practical, concise, and evidence-first.",
          },
          {
            role: "user",
            content: clipped,
          },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = "";
      try {
        const errorPayload = (await response.json()) as {
          msg?: string;
          message?: string;
          error?: string | { message?: string };
        };
        const providerMessage =
          typeof errorPayload.error === "string"
            ? errorPayload.error
            : (errorPayload.error?.message ?? errorPayload.msg ?? errorPayload.message);
        detail = providerMessage ? `: ${providerMessage}` : "";
      } catch {
        detail = "";
      }
      throw new Error(`AgentRouter returned ${response.status}${detail}`);
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    const answer = payload.choices?.[0]?.message?.content;
    if (!answer) throw new Error(payload.error?.message ?? "AgentRouter returned an empty response.");
    return { answer, refused: false };
  } finally {
    clearTimeout(timer);
  }
}
