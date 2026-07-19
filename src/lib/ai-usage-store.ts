import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { withPg, type Queryable } from "./db";

type UsageRow = {
  userId: string;
  day: string;
  requestCount: number;
};

type StoreShape = {
  rows: UsageRow[];
};

let memoryStore: StoreShape | null = null;

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function storePath() {
  return path.join(process.cwd(), ".data", "ai-usage.json");
}

async function loadJsonStore() {
  if (memoryStore) return memoryStore;
  try {
    const parsed = JSON.parse(await readFile(storePath(), "utf8")) as Partial<StoreShape>;
    memoryStore = { rows: parsed.rows ?? [] };
  } catch {
    memoryStore = { rows: [] };
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
    create table if not exists ai_usage (
      user_id text not null,
      day text not null,
      request_count integer not null,
      primary key (user_id, day)
    );
  `);
}

export async function getAiUsage(userId: string, day = todayKey()) {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query("select request_count from ai_usage where user_id = $1 and day = $2", [userId, day]);
    return result.rows[0] ? Number(result.rows[0].request_count) : 0;
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  return store.rows.find((row) => row.userId === userId && row.day === day)?.requestCount ?? 0;
}

export async function reserveAiUsage(userId: string, limit: number, day = todayKey()) {
  const current = await getAiUsage(userId, day);
  if (current >= limit) return { ok: false, used: current, limit };

  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query(
      `insert into ai_usage (user_id, day, request_count)
       values ($1,$2,1)
       on conflict (user_id, day) do update set request_count = ai_usage.request_count + 1
       returning request_count`,
      [userId, day],
    );
    return { ok: true, used: Number(result.rows[0].request_count), limit };
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  const row = store.rows.find((item) => item.userId === userId && item.day === day);
  if (row) row.requestCount += 1;
  else store.rows.push({ userId, day, requestCount: 1 });
  await saveJsonStore(store);
  return { ok: true, used: current + 1, limit };
}
