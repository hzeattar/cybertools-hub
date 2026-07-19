import { NextRequest, NextResponse } from "next/server";
import { ensureBootstrapAdmin, getCurrentUser } from "@/lib/auth";
import { getOrder, markOrderPaid } from "@/lib/order-store";
import { hashToken, issueDownloadToken } from "@/lib/payment";
import { rateLimit } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  await ensureBootstrapAdmin();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = rateLimit(`admin-order-approve:${ip}`, 30, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many admin attempts." }, { status: 429 });

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (order.status === "paid") {
    const token = order.kind === "product" ? issueDownloadToken(order) : undefined;
    return NextResponse.json({ order, downloadToken: token, message: "Order is already paid." });
  }

  const body = (await request.json().catch(() => null)) as { reference?: string } | null;
  const reference = body?.reference?.trim() || `manual-${order.id}`;
  const safeReference = reference.replace(/[^\w:.-]/g, "").slice(0, 120) || `manual-${order.id}`;
  const token = order.kind === "product" ? issueDownloadToken(order) : "";
  const paid = await markOrderPaid(order, safeReference, token ? hashToken(token) : "");

  return NextResponse.json({
    order: paid,
    downloadToken: token || undefined,
    message: "Order manually approved.",
  });
}
