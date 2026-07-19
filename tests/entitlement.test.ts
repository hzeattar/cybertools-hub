import assert from "node:assert/strict";
import test from "node:test";
import { entitlementFromPaidOrder } from "../src/lib/entitlements.ts";
import type { Order } from "../src/lib/payment.ts";

function paidOrder(kind: "product" | "ai_pro"): Order {
  return {
    id: `order-${kind}`,
    userId: "user-1",
    kind,
    productSlug: kind === "ai_pro" ? "ai-pro-pass-30-days" : "bug-bounty-starter-kit",
    productName: "Test",
    basePriceUsdt: 9.99,
    expectedAmountUnits: 9_990_000,
    expectedAmount: "9.990000",
    receiverAddress: "TBGVxoH2Sc6MVHmMtjRsAUZitTQxGEUZUG",
    status: "paid",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    expiresAt: new Date("2026-01-01T00:45:00Z").toISOString(),
  };
}

test("paid product orders create permanent product entitlements", () => {
  const entitlement = entitlementFromPaidOrder(paidOrder("product"), new Date("2026-01-01T00:00:00Z"));
  assert.equal(entitlement?.kind, "product");
  assert.equal(entitlement?.expiresAt, undefined);
});

test("paid AI Pro orders create 30-day entitlements", () => {
  const entitlement = entitlementFromPaidOrder(paidOrder("ai_pro"), new Date("2026-01-01T00:00:00Z"));
  assert.equal(entitlement?.kind, "ai_pro");
  assert.equal(entitlement?.expiresAt, "2026-01-31T00:00:00.000Z");
});
