import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteMemoryCandidate } from "@/lib/ai-workspace-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const { id } = await context.params;
  const deleted = await deleteMemoryCandidate(user.id, id);
  if (!deleted) return NextResponse.json({ error: "Memory candidate not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
