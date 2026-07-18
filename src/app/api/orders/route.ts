import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/data/catalog";
import { createPendingOrder } from "@/lib/payment";
import { saveOrder } from "@/lib/order-store";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
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

  const order = await saveOrder(createPendingOrder(product));
  return NextResponse.json({
    orderId: order.id,
    order,
  });
}
