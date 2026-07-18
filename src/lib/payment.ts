import crypto from "node:crypto";

export type OrderStatus = "pending" | "paid" | "expired";

export type Order = {
  id: string;
  productSlug: string;
  productName: string;
  basePriceUsdt: number;
  expectedAmountUnits: number;
  expectedAmount: string;
  receiverAddress: string;
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
  txHash?: string;
  paidAt?: string;
  downloadTokenHash?: string;
};

export const DEFAULT_TRON_RECEIVER_ADDRESS = "TBGVxoH2Sc6MVHmMtjRsAUZitTQxGEUZUG";
export const DEFAULT_USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const PAYMENT_WINDOW_MINUTES = 45;
export const USDT_DECIMALS = 6;
export const USDT_UNIT = 1_000_000;

export function getReceiverAddress() {
  return process.env.TRON_RECEIVER_ADDRESS ?? DEFAULT_TRON_RECEIVER_ADDRESS;
}

export function getUsdtContract() {
  return process.env.USDT_TRC20_CONTRACT ?? DEFAULT_USDT_TRC20_CONTRACT;
}

export function parseUsdtToUnits(value: string | number) {
  const text = typeof value === "number" ? value.toFixed(6) : String(value).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(text)) {
    throw new Error(`Invalid USDT amount: ${text}`);
  }
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * USDT_UNIT + Number(fraction.padEnd(USDT_DECIMALS, "0"));
}

export function formatUsdtUnits(units: number) {
  const whole = Math.floor(units / USDT_UNIT);
  const fraction = String(units % USDT_UNIT).padStart(USDT_DECIMALS, "0");
  return `${whole}.${fraction}`;
}

export function generateOrderId() {
  return crypto.randomUUID();
}

export function uniqueOffsetUnits(orderId: string, secret = process.env.ORDER_HMAC_SECRET ?? "local-dev-secret") {
  const digest = crypto.createHmac("sha256", secret).update(orderId).digest();
  const value = digest.readUInt32BE(0);
  return 1_000 + (value % 39_000);
}

export function expectedPaymentUnits(basePriceUsdt: number, orderId: string, secret?: string) {
  return parseUsdtToUnits(basePriceUsdt) + uniqueOffsetUnits(orderId, secret);
}

export function createPendingOrder(product: { slug: string; name: string; priceUsdt: number }, now = new Date()) {
  const id = generateOrderId();
  const expectedAmountUnits = expectedPaymentUnits(product.priceUsdt, id);
  const expiresAt = new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000);
  return {
    id,
    productSlug: product.slug,
    productName: product.name,
    basePriceUsdt: product.priceUsdt,
    expectedAmountUnits,
    expectedAmount: formatUsdtUnits(expectedAmountUnits),
    receiverAddress: getReceiverAddress(),
    status: "pending" as const,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function isExpired(order: Pick<Order, "expiresAt">, now = new Date()) {
  return new Date(order.expiresAt).getTime() <= now.getTime();
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function issueDownloadToken(order: Pick<Order, "id" | "productSlug">, now = new Date()) {
  const secret = process.env.DOWNLOAD_SECRET ?? "local-download-secret";
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60_000).toISOString();
  const payload = Buffer.from(JSON.stringify({ orderId: order.id, productSlug: order.productSlug, expiresAt })).toString(
    "base64url",
  );
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyDownloadToken(token: string) {
  const secret = process.env.DOWNLOAD_SECRET ?? "local-download-secret";
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    orderId: string;
    productSlug: string;
    expiresAt: string;
  };
  if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
  return parsed;
}
