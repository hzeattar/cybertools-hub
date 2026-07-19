import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { withPg, type Queryable } from "./db";

export type UserRole = "user" | "admin";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type PublicUser = Pick<User, "id" | "email" | "role" | "createdAt">;

type Session = {
  sessionHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
};

type AuthStoreShape = {
  users: User[];
  sessions: Session[];
};

let memoryStore: AuthStoreShape | null = null;

function storePath() {
  return path.join(process.cwd(), ".data", "auth.json");
}

async function loadJsonStore() {
  if (memoryStore) return memoryStore;
  try {
    const text = await readFile(storePath(), "utf8");
    const parsed = JSON.parse(text) as Partial<AuthStoreShape>;
    memoryStore = { users: parsed.users ?? [], sessions: parsed.sessions ?? [] };
  } catch {
    memoryStore = { users: [], sessions: [] };
  }
  return memoryStore;
}

async function saveJsonStore(store: AuthStoreShape) {
  await mkdir(path.dirname(storePath()), { recursive: true });
  await writeFile(storePath(), JSON.stringify(store, null, 2), "utf8");
  memoryStore = store;
}

async function ensureAuthPg(pool: Queryable) {
  await pool.query(`
    create table if not exists users (
      id text primary key,
      email text not null unique,
      password_hash text not null,
      role text not null default 'user',
      created_at timestamptz not null,
      updated_at timestamptz not null
    );
  `);
  await pool.query(`
    create table if not exists sessions (
      session_hash text primary key,
      user_id text not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null
    );
  `);
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    role: row.role === "admin" ? "admin" : "user",
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
}

export async function createUser(input: { email: string; passwordHash: string; role?: UserRole }) {
  const now = new Date().toISOString();
  const user: User = {
    id: crypto.randomUUID(),
    email: input.email,
    passwordHash: input.passwordHash,
    role: input.role ?? "user",
    createdAt: now,
    updatedAt: now,
  };

  const pgResult = await withPg(async (pool) => {
    await ensureAuthPg(pool);
    await pool.query(
      `insert into users (id, email, password_hash, role, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [user.id, user.email, user.passwordHash, user.role, user.createdAt, user.updatedAt],
    );
    return user;
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  if (store.users.some((item) => item.email === user.email)) {
    throw new Error("User already exists.");
  }
  store.users.push(user);
  await saveJsonStore(store);
  return user;
}

export async function getUserByEmail(email: string) {
  const pgResult = await withPg(async (pool) => {
    await ensureAuthPg(pool);
    const result = await pool.query("select * from users where email = $1", [email]);
    return result.rows[0] ? rowToUser(result.rows[0]) : null;
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  return store.users.find((user) => user.email === email) ?? null;
}

export async function getUserById(id: string) {
  const pgResult = await withPg(async (pool) => {
    await ensureAuthPg(pool);
    const result = await pool.query("select * from users where id = $1", [id]);
    return result.rows[0] ? rowToUser(result.rows[0]) : null;
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  return store.users.find((user) => user.id === id) ?? null;
}

export async function hasAnyAdmin() {
  const pgResult = await withPg(async (pool) => {
    await ensureAuthPg(pool);
    const result = await pool.query("select id from users where role = 'admin' limit 1");
    return result.rows.length > 0;
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  return store.users.some((user) => user.role === "admin");
}

export async function saveSession(input: { sessionHash: string; userId: string; expiresAt: string }) {
  const session: Session = {
    sessionHash: input.sessionHash,
    userId: input.userId,
    expiresAt: input.expiresAt,
    createdAt: new Date().toISOString(),
  };

  const pgResult = await withPg(async (pool) => {
    await ensureAuthPg(pool);
    await pool.query(
      `insert into sessions (session_hash, user_id, expires_at, created_at)
       values ($1,$2,$3,$4)`,
      [session.sessionHash, session.userId, session.expiresAt, session.createdAt],
    );
    return session;
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  store.sessions.push(session);
  await saveJsonStore(store);
  return session;
}

export async function getSession(sessionHash: string) {
  const pgResult = await withPg(async (pool) => {
    await ensureAuthPg(pool);
    const result = await pool.query("select * from sessions where session_hash = $1", [sessionHash]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      sessionHash: String(row.session_hash),
      userId: String(row.user_id),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  return store.sessions.find((session) => session.sessionHash === sessionHash) ?? null;
}

export async function deleteSession(sessionHash: string) {
  const pgResult = await withPg(async (pool) => {
    await ensureAuthPg(pool);
    await pool.query("delete from sessions where session_hash = $1", [sessionHash]);
    return true;
  });
  if (pgResult) return;

  const store = await loadJsonStore();
  store.sessions = store.sessions.filter((session) => session.sessionHash !== sessionHash);
  await saveJsonStore(store);
}
