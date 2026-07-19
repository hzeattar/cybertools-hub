import { NextResponse } from "next/server";
import { getOrder, markOrderExpired } from "@/lib/order-store";
import { isExpired } from "@/lib/payment";
import { getCurrentUser } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.status === "pending" && isExpired(order)) {
    const expired = await markOrderExpired(order);
    return NextResponse.json({ order: expired });
  }

  return NextResponse.json({ order });
}
