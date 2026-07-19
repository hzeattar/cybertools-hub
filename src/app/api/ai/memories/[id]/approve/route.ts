import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { approveMemoryCandidate } from "@/lib/ai-workspace-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const { id } = await context.params;
  const memory = await approveMemoryCandidate(user.id, id);
  if (!memory) return NextResponse.json({ error: "Memory candidate not found." }, { status: 404 });
  return NextResponse.json({ memory });
}
