import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Order } from "./payment";
import { entitlementFromPaidOrder, type Entitlement } from "./entitlements";
import { withPg, type Queryable } from "./db";

type StoreShape = {
  orders: Order[];
  usedTransactions: { txHash: string; orderId: string; amount: string; confirmedAt: string }[];
  entitlements: Entitlement[];
};

const initialStore: StoreShape = { orders: [], usedTransactions: [], entitlements: [] };
let memoryStore: StoreShape | null = null;

function storePath() {
  return path.join(process.cwd(), ".data", "orders.json");
}

async function loadJsonStore() {
  if (memoryStore) return memoryStore;
  try {
    const text = await readFile(storePath(), "utf8");
    const parsed = JSON.parse(text) as Partial<StoreShape>;
    memoryStore = {
      orders: (parsed.orders ?? []).map((order) => ({ ...order, kind: order.kind ?? "product" })),
      usedTransactions: parsed.usedTransactions ?? [],
      entitlements: parsed.entitlements ?? [],
    };
  } catch {
    memoryStore = { ...initialStore, orders: [], usedTransactions: [], entitlements: [] };
  }
  return memoryStore;
}

async function saveJsonStore(store: StoreShape) {
  await mkdir(path.dirname(storePath()), { recursive: true });
  await writeFile(storePath(), JSON.stringify(store, null, 2), "utf8");
  memoryStore = store;
}

async function ensurePg(pool: Queryable) {
  await pool.query(`
    create table if not exists orders (
      id text primary key,
      user_id text,
      kind text not null default 'product',
      product_slug text not null,
      product_name text not null,
      base_price_usdt numeric not null,
      expected_amount_units integer not null,
      expected_amount text not null,
      receiver_address text not null,
      status text not null,
      created_at timestamptz not null,
      expires_at timestamptz not null,
      tx_hash text,
      paid_at timestamptz,
      download_token_hash text
    );
  `);
  await pool.query("alter table orders add column if not exists user_id text");
  await pool.query("alter table orders add column if not exists kind text not null default 'product'");
  await pool.query(`
    create table if not exists used_transactions (
      tx_hash text primary key,
      order_id text not null,
      amount text not null,
      confirmed_at timestamptz not null
    );
  `);
  await pool.query(`
    create table if not exists entitlements (
      id text primary key,
      user_id text not null,
      kind text not null,
      product_slug text not null,
      expires_at timestamptz,
      source_order_id text not null unique,
      created_at timestamptz not null
    );
  `);
  await pool.query("create index if not exists entitlements_user_id_idx on entitlements(user_id)");
  await pool.query("create index if not exists orders_user_id_idx on orders(user_id)");
}

function rowToOrder(row: Record<string, unknown>): Order {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : undefined,
    kind: row.kind === "ai_pro" ? "ai_pro" : "product",
    productSlug: String(row.product_slug),
    productName: String(row.product_name),
    basePriceUsdt: Number(row.base_price_usdt),
    expectedAmountUnits: Number(row.expected_amount_units),
    expectedAmount: String(row.expected_amount),
    receiverAddress: String(row.receiver_address),
    status: row.status as Order["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    txHash: row.tx_hash ? String(row.tx_hash) : undefined,
    paidAt: row.paid_at ? new Date(String(row.paid_at)).toISOString() : undefined,
    downloadTokenHash: row.download_token_hash ? String(row.download_token_hash) : undefined,
  };
}

function rowToEntitlement(row: Record<string, unknown>): Entitlement {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kind: row.kind === "ai_pro" ? "ai_pro" : "product",
    productSlug: String(row.product_slug),
    expiresAt: row.expires_at ? new Date(String(row.expires_at)).toISOString() : undefined,
    sourceOrderId: String(row.source_order_id),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function saveOrder(order: Order) {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    await pool.query(
      `insert into orders (
        id, user_id, kind, product_slug, product_name, base_price_usdt, expected_amount_units,
        expected_amount, receiver_address, status, created_at, expires_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        order.id,
        order.userId ?? null,
        order.kind,
        order.productSlug,
        order.productName,
        order.basePriceUsdt,
        order.expectedAmountUnits,
        order.expectedAmount,
        order.receiverAddress,
        order.status,
        order.createdAt,
        order.expiresAt,
      ],
    );
    return order;
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  store.orders.push(order);
  await saveJsonStore(store);
  return order;
}

export async function getOrder(id: string) {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query("select * from orders where id = $1", [id]);
    return result.rows[0] ? rowToOrder(result.rows[0]) : null;
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  return store.orders.find((order) => order.id === id) ?? null;
}

export async function listOrders(options: { userId?: string } = {}) {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = options.userId
      ? await pool.query("select * from orders where user_id = $1 order by created_at desc limit 100", [options.userId])
      : await pool.query("select * from orders order by created_at desc limit 100");
    return result.rows.map(rowToOrder);
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  const filtered = options.userId ? store.orders.filter((order) => order.userId === options.userId) : store.orders;
  return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
}

export async function listEntitlementsForUser(userId: string) {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query("select * from entitlements where user_id = $1 order by created_at desc", [userId]);
    return result.rows.map(rowToEntitlement);
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  return store.entitlements
    .filter((entitlement) => entitlement.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function hasActiveEntitlement(userId: string, kind: Entitlement["kind"], productSlug?: string) {
  const entitlements = await listEntitlementsForUser(userId);
  return entitlements.some((entitlement) => {
    const kindMatches = entitlement.kind === kind;
    const productMatches = !productSlug || entitlement.productSlug === productSlug;
    const active = !entitlement.expiresAt || new Date(entitlement.expiresAt).getTime() > Date.now();
    return kindMatches && productMatches && active;
  });
}

export async function markOrderExpired(order: Order) {
  const updated = { ...order, status: "expired" as const };
  await updateOrder(updated);
  return updated;
}

export async function markOrderPaid(order: Order, txHash: string, tokenHash: string) {
  const paidAt = new Date().toISOString();
  const updated = {
    ...order,
    status: "paid" as const,
    txHash,
    paidAt,
    downloadTokenHash: order.kind === "product" ? tokenHash : undefined,
  };

  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    await pool.query("begin");
    try {
      await pool.query(
        "insert into used_transactions (tx_hash, order_id, amount, confirmed_at) values ($1,$2,$3,$4) on conflict do nothing",
        [txHash, order.id, order.expectedAmount, paidAt],
      );
      await pool.query(
        "update orders set status = $1, tx_hash = $2, paid_at = $3, download_token_hash = $4 where id = $5",
        ["paid", txHash, paidAt, updated.downloadTokenHash ?? null, order.id],
      );
      await insertEntitlementPg(pool, updated);
      await pool.query("commit");
      return updated;
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  store.orders = store.orders.map((item) => (item.id === order.id ? updated : item));
  if (!store.usedTransactions.some((item) => item.txHash === txHash)) {
    store.usedTransactions.push({ txHash, orderId: order.id, amount: order.expectedAmount, confirmedAt: paidAt });
  }
  const entitlement = entitlementFromPaidOrder(updated, new Date(paidAt));
  if (entitlement && !store.entitlements.some((item) => item.sourceOrderId === order.id)) {
    store.entitlements.push(entitlement);
  }
  await saveJsonStore(store);
  return updated;
}

async function insertEntitlementPg(pool: Queryable, order: Order) {
  const entitlement = entitlementFromPaidOrder(order, order.paidAt ? new Date(order.paidAt) : new Date());
  if (!entitlement) return;
  await pool.query(
    `insert into entitlements (id, user_id, kind, product_slug, expires_at, source_order_id, created_at)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (source_order_id) do nothing`,
    [
      entitlement.id,
      entitlement.userId,
      entitlement.kind,
      entitlement.productSlug,
      entitlement.expiresAt ?? null,
      entitlement.sourceOrderId,
      entitlement.createdAt,
    ],
  );
}

export async function isTransactionUsed(txHash: string) {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query("select tx_hash from used_transactions where tx_hash = $1", [txHash]);
    return result.rows.length > 0;
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  return store.usedTransactions.some((item) => item.txHash === txHash);
}

async function updateOrder(order: Order) {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    await pool.query(
      "update orders set status = $1, tx_hash = $2, paid_at = $3, download_token_hash = $4 where id = $5",
      [order.status, order.txHash ?? null, order.paidAt ?? null, order.downloadTokenHash ?? null, order.id],
    );
    return order;
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  store.orders = store.orders.map((item) => (item.id === order.id ? order : item));
  await saveJsonStore(store);
  return order;
}
