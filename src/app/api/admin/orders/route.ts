import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "@/lib/order-store";
import { rateLimit } from "@/lib/rate-limit";
import { ensureBootstrapAdmin, getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  await ensureBootstrapAdmin();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = rateLimit(`admin:${ip}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many admin attempts." }, { status: 429 });
  }

  return NextResponse.json({ orders: await listOrders() });
}
