import { NextRequest, NextResponse } from "next/server";
import { callCyberAi, getAiLimit, maxPromptLength, type CyberAiPlan } from "@/lib/agentrouter";
import { reserveAiUsage } from "@/lib/ai-usage-store";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveEntitlement } from "@/lib/order-store";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const ipLimit = rateLimit(`ai:${ip}`, 60, 60_000);
  if (!ipLimit.ok) return NextResponse.json({ error: "Too many AI requests." }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const rawMessage = body?.message?.trim() ?? "";
  if (rawMessage.length < 8) {
    return NextResponse.json({ error: "Describe what you want the Cyber AI Analyst to review." }, { status: 400 });
  }

  const plan: CyberAiPlan = (await hasActiveEntitlement(user.id, "ai_pro")) ? "pro" : "free";
  const limit = getAiLimit(plan);
  const reservation = await reserveAiUsage(user.id, limit);
  if (!reservation.ok) {
    return NextResponse.json({ error: "Daily AI limit reached.", usage: reservation, plan }, { status: 429 });
  }

  try {
    const message = rawMessage.slice(0, maxPromptLength(plan));
    const result = await callCyberAi({ message, plan });
    return NextResponse.json({
      answer: result.answer,
      refused: result.refused,
      provider: result.provider,
      providerLabel: result.providerLabel,
      fallback: result.fallback,
      plan,
      usage: reservation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Cyber AI is temporarily unavailable: ${(error as Error).message}`,
        plan,
        usage: reservation,
      },
      { status: 502 },
    );
  }
}
