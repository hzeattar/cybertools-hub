import { NextResponse } from "next/server";
import { getOrder, markOrderExpired } from "@/lib/order-store";
import { isExpired } from "@/lib/payment";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.status === "pending" && isExpired(order)) {
    const expired = await markOrderExpired(order);
    return NextResponse.json({ order: expired });
  }

  return NextResponse.json({ order });
}
