import { NextRequest, NextResponse } from "next/server";
import {
  callCyberAi,
  getAiLimit,
  maxPromptLength,
  type CyberAiPlan,
  type CyberAiProviderPreference,
} from "@/lib/agentrouter";
import { getAiAgent } from "@/lib/ai-agents";
import { reserveAiUsage } from "@/lib/ai-usage-store";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { hasActiveEntitlement } from "@/lib/order-store";
import {
  appendMessage,
  createMemoryCandidate,
  formatAiContext,
  getConversationForUser,
  listMessagesForConversation,
  recordAgentRun,
  searchAiContext,
  suggestMemoryFromMessage,
} from "@/lib/ai-workspace-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const { id } = await context.params;
  const messages = await listMessagesForConversation(user.id, id);
  if (!messages) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const ipLimit = rateLimit(`ai-chat:${ip}`, 60, 60_000);
  if (!ipLimit.ok) return NextResponse.json({ error: "Too many AI requests." }, { status: 429 });

  const { id } = await context.params;
  const conversation = await getConversationForUser(user.id, id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as
    | { message?: string; agentId?: string; providerPreference?: CyberAiProviderPreference }
    | null;
  const rawMessage = body?.message?.trim() ?? "";
  if (rawMessage.length < 8) {
    return NextResponse.json({ error: "Describe what you want the AI workspace to review." }, { status: 400 });
  }

  const agent = getAiAgent(body?.agentId ?? conversation.agentId);
  const plan: CyberAiPlan = (await hasActiveEntitlement(user.id, "ai_pro")) ? "pro" : "free";
  const limit = getAiLimit(plan);
  const reservation = await reserveAiUsage(user.id, limit);
  if (!reservation.ok) {
    return NextResponse.json({ error: "Daily AI limit reached.", usage: reservation, plan }, { status: 429 });
  }

  const message = rawMessage.slice(0, maxPromptLength(plan));
  const previousMessages =
    (await listMessagesForConversation(user.id, conversation.id))?.map((item) => ({
      role: item.role,
      content: item.content,
    })) ?? [];
  const userMessage = await appendMessage({
    userId: user.id,
    conversationId: conversation.id,
    role: "user",
    content: message,
  });

  const contextMatches = await searchAiContext(user.id, message, plan === "pro" ? 8 : 5);
  const contextBlock = formatAiContext(contextMatches);
  const result = await callCyberAi({
    message,
    plan,
    agentInstruction: agent.systemInstruction,
    context: contextBlock,
    providerPreference: body?.providerPreference,
    conversationHistory: previousMessages,
  });

  const assistantMessage = await appendMessage({
    userId: user.id,
    conversationId: conversation.id,
    role: "assistant",
    content: result.answer,
    provider: result.provider,
    providerLabel: result.providerLabel,
    fallback: result.fallback,
  });

  const suggestion = suggestMemoryFromMessage(message);
  const memoryCandidate = suggestion
    ? await createMemoryCandidate({
        userId: user.id,
        conversationId: conversation.id,
        messageId: userMessage.id,
        content: suggestion.content,
        reason: suggestion.reason,
      })
    : null;

  await recordAgentRun({
    userId: user.id,
    conversationId: conversation.id,
    agentId: agent.id,
    providerLabel: result.providerLabel,
    fallback: result.fallback,
  });

  return NextResponse.json({
    messages: [userMessage, assistantMessage],
    memoryCandidates: memoryCandidate ? [memoryCandidate] : [],
    context: contextMatches.map((match) => ({ type: match.type, title: match.title, score: match.score })),
    provider: result.provider,
    providerLabel: result.providerLabel,
    fallback: result.fallback,
    attempts: result.attempts,
    plan,
    usage: reservation,
  });
}
