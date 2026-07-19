import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/data/catalog";
import { createPendingOrder } from "@/lib/payment";
import { hasActiveEntitlement, saveOrder } from "@/lib/order-store";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required before checkout." }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = rateLimit(`orders:${ip}`, 8, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many order attempts." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { productSlug?: string } | null;
  const product = body?.productSlug ? getProduct(body.productSlug) : null;
  if (!product) {
    return NextResponse.json({ error: "Unknown product." }, { status: 400 });
  }

  const owned = await hasActiveEntitlement(user.id, product.kind, product.kind === "product" ? product.slug : undefined);
  if (owned) {
    return NextResponse.json({ error: "Product or pass already active on this account.", owned: true }, { status: 409 });
  }

  const order = await saveOrder(createPendingOrder(product, user.id));
  return NextResponse.json({
    orderId: order.id,
    order,
  });
}
