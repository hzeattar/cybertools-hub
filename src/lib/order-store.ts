import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Order } from "./payment";

type StoreShape = {
  orders: Order[];
  usedTransactions: { txHash: string; orderId: string; amount: string; confirmedAt: string }[];
};

const initialStore: StoreShape = { orders: [], usedTransactions: [] };
let memoryStore: StoreShape | null = null;

function storePath() {
  return path.join(process.cwd(), ".data", "orders.json");
}

async function loadJsonStore() {
  if (memoryStore) return memoryStore;
  try {
    const text = await readFile(storePath(), "utf8");
    memoryStore = JSON.parse(text) as StoreShape;
  } catch {
    memoryStore = { ...initialStore, orders: [], usedTransactions: [] };
  }
  return memoryStore;
}

async function saveJsonStore(store: StoreShape) {
  await mkdir(path.dirname(storePath()), { recursive: true });
  await writeFile(storePath(), JSON.stringify(store, null, 2), "utf8");
  memoryStore = store;
}

async function withPg<T>(operation: (pool: unknown) => Promise<T>) {
  const connectionString = process.env.DATABASE_URL;
  const shouldUsePostgres =
    Boolean(connectionString) &&
    (process.env.NODE_ENV === "production" || process.env.STORAGE_DRIVER === "postgres");
  if (!shouldUsePostgres) return null;
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<{
    Pool: new (config: { connectionString: string }) => unknown;
  }>;
  let Pool: new (config: { connectionString: string }) => unknown;
  try {
    ({ Pool } = await dynamicImport("pg"));
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    return null;
  }
  const pool = new Pool({ connectionString: connectionString as string });
  return operation(pool);
}

async function ensurePg(pool: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}) {
  await pool.query(`
    create table if not exists orders (
      id text primary key,
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
  await pool.query(`
    create table if not exists used_transactions (
      tx_hash text primary key,
      order_id text not null,
      amount text not null,
      confirmed_at timestamptz not null
    );
  `);
}

function rowToOrder(row: Record<string, unknown>): Order {
  return {
    id: String(row.id),
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

export async function saveOrder(order: Order) {
  const pgResult = await withPg(async (poolLike) => {
    const pool = poolLike as { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
    await ensurePg(pool);
    await pool.query(
      `insert into orders (
        id, product_slug, product_name, base_price_usdt, expected_amount_units,
        expected_amount, receiver_address, status, created_at, expires_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        order.id,
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
  const pgResult = await withPg(async (poolLike) => {
    const pool = poolLike as { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };
    await ensurePg(pool);
    const result = await pool.query("select * from orders where id = $1", [id]);
    return result.rows[0] ? rowToOrder(result.rows[0]) : null;
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  return store.orders.find((order) => order.id === id) ?? null;
}

export async function listOrders() {
  const pgResult = await withPg(async (poolLike) => {
    const pool = poolLike as { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };
    await ensurePg(pool);
    const result = await pool.query("select * from orders order by created_at desc limit 100");
    return result.rows.map(rowToOrder);
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  return [...store.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
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
    downloadTokenHash: tokenHash,
  };

  const pgResult = await withPg(async (poolLike) => {
    const pool = poolLike as { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
    await ensurePg(pool);
    await pool.query("begin");
    await pool.query(
      "insert into used_transactions (tx_hash, order_id, amount, confirmed_at) values ($1,$2,$3,$4) on conflict do nothing",
      [txHash, order.id, order.expectedAmount, paidAt],
    );
    await pool.query(
      "update orders set status = $1, tx_hash = $2, paid_at = $3, download_token_hash = $4 where id = $5",
      ["paid", txHash, paidAt, tokenHash, order.id],
    );
    await pool.query("commit");
    return updated;
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  store.orders = store.orders.map((item) => (item.id === order.id ? updated : item));
  if (!store.usedTransactions.some((item) => item.txHash === txHash)) {
    store.usedTransactions.push({ txHash, orderId: order.id, amount: order.expectedAmount, confirmedAt: paidAt });
  }
  await saveJsonStore(store);
  return updated;
}

export async function isTransactionUsed(txHash: string) {
  const pgResult = await withPg(async (poolLike) => {
    const pool = poolLike as { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
    await ensurePg(pool);
    const result = await pool.query("select tx_hash from used_transactions where tx_hash = $1", [txHash]);
    return result.rows.length > 0;
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  return store.usedTransactions.some((item) => item.txHash === txHash);
}

async function updateOrder(order: Order) {
  const pgResult = await withPg(async (poolLike) => {
    const pool = poolLike as { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
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
