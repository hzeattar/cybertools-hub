import { NextRequest, NextResponse } from "next/server";
import { ensureBootstrapAdmin, getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { updateSupportMessageStatus, type SupportStatus } from "@/lib/support-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  await ensureBootstrapAdmin();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = rateLimit(`admin-support-update:${ip}`, 40, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many admin attempts." }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { status?: SupportStatus } | null;
  const status = body?.status === "closed" ? "closed" : body?.status === "open" ? "open" : null;
  if (!status) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const { id } = await context.params;
  const message = await updateSupportMessageStatus(id, status);
  if (!message) return NextResponse.json({ error: "Support message not found." }, { status: 404 });

  return NextResponse.json({ message });
}
