import assert from "node:assert/strict";
import test from "node:test";
import {
  expectedPaymentUnits,
  formatUsdtUnits,
  parseUsdtToUnits,
  uniqueOffsetUnits,
  verifyDownloadToken,
  issueDownloadToken,
} from "../src/lib/payment.ts";

test("USDT parsing and formatting keep six decimals", () => {
  assert.equal(parseUsdtToUnits("9.990001"), 9_990_001);
  assert.equal(formatUsdtUnits(9_990_001), "9.990001");
});

test("unique order offsets are deterministic and non-zero", () => {
  const first = uniqueOffsetUnits("order-a", "secret");
  const second = uniqueOffsetUnits("order-a", "secret");
  const third = uniqueOffsetUnits("order-b", "secret");

  assert.equal(first, second);
  assert.notEqual(first, third);
  assert.ok(first >= 1_000);
  assert.ok(first <= 39_999);
});

test("expected payment amount includes unique micro USDT offset", () => {
  const expected = expectedPaymentUnits(9.99, "order-a", "secret");
  assert.ok(expected > parseUsdtToUnits("9.99"));
  assert.ok(expected < parseUsdtToUnits("10.03"));
});

test("download tokens round-trip with signed payloads", () => {
  const token = issueDownloadToken({ id: "order-1", productSlug: "kit" }, new Date());
  const payload = verifyDownloadToken(token);
  assert.equal(payload?.orderId, "order-1");
  assert.equal(payload?.productSlug, "kit");
});
