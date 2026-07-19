import { NextRequest, NextResponse } from "next/server";
import { aiAgents } from "@/lib/ai-agents";
import { aiProviderCatalog } from "@/lib/agentrouter";
import { getCurrentUser } from "@/lib/auth";
import { createConversation, listConversations } from "@/lib/ai-workspace-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const conversations = await listConversations(user.id);
  return NextResponse.json({ conversations, agents: aiAgents, providers: aiProviderCatalog });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { agentId?: string; title?: string } | null;
  const conversation = await createConversation({
    userId: user.id,
    agentId: body?.agentId,
    title: body?.title,
  });

  return NextResponse.json({ conversation, agents: aiAgents, providers: aiProviderCatalog });
}
