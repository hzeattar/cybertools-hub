import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { withPg, type Queryable } from "./db";

export type SupportStatus = "open" | "closed";

export type SupportMessage = {
  id: string;
  userId?: string;
  email: string;
  subject: string;
  body: string;
  orderId?: string;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
};

type SupportShape = {
  messages: SupportMessage[];
};

const initialStore: SupportShape = { messages: [] };
let memoryStore: SupportShape | null = null;

function storePath() {
  return path.join(process.cwd(), ".data", "support.json");
}

async function loadJsonStore() {
  if (memoryStore) return memoryStore;
  try {
    const text = await readFile(storePath(), "utf8");
    const parsed = JSON.parse(text) as Partial<SupportShape>;
    memoryStore = { messages: parsed.messages ?? [] };
  } catch {
    memoryStore = { ...initialStore, messages: [] };
  }
  return memoryStore;
}

async function saveJsonStore(store: SupportShape) {
  await mkdir(path.dirname(storePath()), { recursive: true });
  await writeFile(storePath(), JSON.stringify(store, null, 2), "utf8");
  memoryStore = store;
}

async function ensurePg(pool: Queryable) {
  await pool.query(`
    create table if not exists support_messages (
      id text primary key,
      user_id text,
      email text not null,
      subject text not null,
      body text not null,
      order_id text,
      status text not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    );
  `);
  await pool.query("create index if not exists support_messages_status_idx on support_messages(status)");
  await pool.query("create index if not exists support_messages_user_id_idx on support_messages(user_id)");
}

function rowToSupportMessage(row: Record<string, unknown>): SupportMessage {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : undefined,
    email: String(row.email),
    subject: String(row.subject),
    body: String(row.body),
    orderId: row.order_id ? String(row.order_id) : undefined,
    status: row.status === "closed" ? "closed" : "open",
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function createSupportMessage(input: {
  userId?: string;
  email: string;
  subject: string;
  body: string;
  orderId?: string;
}) {
  const now = new Date().toISOString();
  const message: SupportMessage = {
    id: crypto.randomUUID(),
    userId: input.userId,
    email: input.email.trim().toLowerCase(),
    subject: input.subject.trim(),
    body: input.body.trim(),
    orderId: input.orderId?.trim() || undefined,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    await pool.query(
      `insert into support_messages (id, user_id, email, subject, body, order_id, status, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        message.id,
        message.userId ?? null,
        message.email,
        message.subject,
        message.body,
        message.orderId ?? null,
        message.status,
        message.createdAt,
        message.updatedAt,
      ],
    );
    return message;
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  store.messages.push(message);
  await saveJsonStore(store);
  return message;
}

export async function listSupportMessages() {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query("select * from support_messages order by created_at desc limit 100");
    return result.rows.map(rowToSupportMessage);
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  return [...store.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
}

export async function updateSupportMessageStatus(id: string, status: SupportStatus) {
  const updatedAt = new Date().toISOString();
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query(
      "update support_messages set status = $1, updated_at = $2 where id = $3 returning *",
      [status, updatedAt, id],
    );
    return result.rows[0] ? rowToSupportMessage(result.rows[0]) : null;
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  const existing = store.messages.find((message) => message.id === id);
  if (!existing) return null;
  const updated = { ...existing, status, updatedAt };
  store.messages = store.messages.map((message) => (message.id === id ? updated : message));
  await saveJsonStore(store);
  return updated;
}
