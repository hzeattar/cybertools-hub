export type AiAgentId =
  | "security-analyst"
  | "code-reviewer"
  | "scope-guard"
  | "report-writer"
  | "threat-modeler"
  | "api-risk-mapper";

export type AiAgent = {
  id: AiAgentId;
  name: string;
  shortName: string;
  description: string;
  icon: "shield" | "code" | "scope" | "report" | "threat" | "api";
  systemInstruction: string;
  starterPrompt: string;
};

export const aiAgents: AiAgent[] = [
  {
    id: "security-analyst",
    name: "Security Analyst",
    shortName: "Analyst",
    description: "Prioritizes defensive findings, headers, configs, and evidence into report-ready guidance.",
    icon: "shield",
    systemInstruction:
      "Act as a senior defensive application security analyst. Prioritize risks, reduce false positives, and keep every recommendation scoped to authorized systems.",
    starterPrompt:
      "Review this authorized security context and return prioritized findings, safe validation steps, and report-ready wording.",
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    shortName: "Code",
    description: "Reviews pasted code snippets for auth, data exposure, injection, and session handling risks.",
    icon: "code",
    systemInstruction:
      "Act as a defensive secure code reviewer. Explain risky patterns, likely exploit preconditions, safe tests, and concrete remediation. Do not provide weaponized exploit automation.",
    starterPrompt:
      "Review this code for defensive security issues. Focus on authorization, input validation, secrets, sessions, and data exposure.",
  },
  {
    id: "scope-guard",
    name: "Scope Guard",
    shortName: "Scope",
    description: "Turns program rules into allowed, blocked, and clarify-before-testing decisions.",
    icon: "scope",
    systemInstruction:
      "Act as a bug bounty scope guard. If authorization or scope is unclear, mark the action as blocked until clarified. Never encourage testing outside policy.",
    starterPrompt:
      "Convert this scope or policy text into in-scope, out-of-scope, unclear, safe next steps, and stop conditions.",
  },
  {
    id: "report-writer",
    name: "Report Writer",
    shortName: "Report",
    description: "Formats evidence-first vulnerability reports with redaction and reproducibility in mind.",
    icon: "report",
    systemInstruction:
      "Act as a vulnerability report editor. Build concise summaries, reproducible steps, impact, evidence notes, and remediation. Do not invent facts not present in the prompt.",
    starterPrompt:
      "Turn these notes into a professional vulnerability report. Keep impact evidence-based and mark missing details clearly.",
  },
  {
    id: "threat-modeler",
    name: "Threat Modeler",
    shortName: "Threat",
    description: "Creates compact threat models for features, APIs, user journeys, and trust boundaries.",
    icon: "threat",
    systemInstruction:
      "Act as a product security threat modeler. Identify assets, actors, trust boundaries, abuse cases, controls, and open questions. Keep it practical and defensive.",
    starterPrompt:
      "Build a compact threat model for this feature or flow with assets, trust boundaries, abuse cases, controls, and open questions.",
  },
  {
    id: "api-risk-mapper",
    name: "API Risk Mapper",
    shortName: "API",
    description: "Ranks endpoint lists and OpenAPI fragments by auth, object, data, and state-change risk.",
    icon: "api",
    systemInstruction:
      "Act as an API security risk mapper. Rank endpoints by identity, object authorization, sensitive data, state change, admin scope, exports, and webhook risk.",
    starterPrompt:
      "Rank this API surface by defensive test priority and produce a safe review plan for authorized testing.",
  },
];

export const defaultAgentId: AiAgentId = "security-analyst";

export function getAiAgent(id?: string | null) {
  return aiAgents.find((agent) => agent.id === id) ?? aiAgents[0];
}
