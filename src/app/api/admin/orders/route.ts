import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "@/lib/order-store";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = rateLimit(`admin:${ip}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many admin attempts." }, { status: 429 });
  }

  const configured = process.env.ADMIN_PASSWORD;
  if (!configured || request.headers.get("x-admin-password") !== configured) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ orders: await listOrders() });
}
