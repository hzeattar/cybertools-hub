import crypto from "node:crypto";
import type { Order } from "./payment.ts";

export type Entitlement = {
  id: string;
  userId: string;
  kind: "product" | "ai_pro";
  productSlug: string;
  expiresAt?: string;
  sourceOrderId: string;
  createdAt: string;
};

export function entitlementFromPaidOrder(order: Order, now = new Date()): Entitlement | null {
  if (!order.userId || order.status !== "paid") return null;
  const expiresAt =
    order.kind === "ai_pro" ? new Date(now.getTime() + 30 * 24 * 60 * 60_000).toISOString() : undefined;
  return {
    id: crypto.randomUUID(),
    userId: order.userId,
    kind: order.kind,
    productSlug: order.productSlug,
    expiresAt,
    sourceOrderId: order.id,
    createdAt: now.toISOString(),
  };
}
