import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listMemories, listMemoryCandidates } from "@/lib/ai-workspace-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const [memories, pending] = await Promise.all([listMemories(user.id), listMemoryCandidates(user.id, "pending")]);
  return NextResponse.json({ memories, pending });
}
