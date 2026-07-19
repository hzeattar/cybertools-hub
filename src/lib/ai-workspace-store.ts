import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultAgentId, getAiAgent, type AiAgentId } from "./ai-agents.ts";
import { withPg, type Queryable } from "./db.ts";

export type AiConversation = {
  id: string;
  userId: string;
  title: string;
  agentId: AiAgentId;
  createdAt: string;
  updatedAt: string;
};

export type AiMessageRole = "user" | "assistant";

export type AiMessage = {
  id: string;
  conversationId: string;
  userId: string;
  role: AiMessageRole;
  content: string;
  providerLabel?: string;
  provider?: string;
  fallback?: boolean;
  createdAt: string;
};

export type AiMemoryCandidateStatus = "pending" | "approved" | "deleted";

export type AiMemoryCandidate = {
  id: string;
  userId: string;
  conversationId: string;
  messageId?: string;
  content: string;
  reason: string;
  status: AiMemoryCandidateStatus;
  createdAt: string;
  updatedAt: string;
};

export type AiMemory = {
  id: string;
  userId: string;
  content: string;
  sourceCandidateId?: string;
  createdAt: string;
  updatedAt: string;
};

export type AiKnowledgeSource = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  createdAt: string;
};

export type AiKnowledgeChunk = {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  keywords: string[];
  createdAt: string;
};

export type AiAgentRun = {
  id: string;
  userId: string;
  conversationId: string;
  agentId: AiAgentId;
  providerLabel: string;
  fallback: boolean;
  createdAt: string;
};

export type AiContextMatch = {
  type: "memory" | "knowledge";
  title: string;
  content: string;
  score: number;
};

type StoreShape = {
  conversations: AiConversation[];
  messages: AiMessage[];
  memoryCandidates: AiMemoryCandidate[];
  memories: AiMemory[];
  knowledgeSources: AiKnowledgeSource[];
  knowledgeChunks: AiKnowledgeChunk[];
  agentRuns: AiAgentRun[];
};

const seedDate = "2026-07-19T00:00:00.000Z";

const seededKnowledge = [
  {
    source: {
      id: "src-authorized-testing",
      slug: "authorized-testing",
      title: "Authorized Testing Rules",
      summary: "Core rules for scope-safe defensive security analysis.",
      createdAt: seedDate,
    },
    chunks: [
      {
        id: "chunk-scope-first",
        title: "Scope first",
        content:
          "Before any security test, confirm written authorization, in-scope assets, allowed test types, rate limits, data boundaries, and stop conditions. If scope is ambiguous, mark the action blocked until clarified.",
        keywords: ["scope", "authorization", "bug bounty", "policy", "stop"],
      },
      {
        id: "chunk-evidence-redaction",
        title: "Evidence redaction",
        content:
          "Reports should include reproducible evidence with secrets, bearer tokens, cookies, personal data, and unrelated third-party records redacted. Keep payloads minimal and avoid destructive actions.",
        keywords: ["evidence", "redaction", "report", "token", "privacy"],
      },
    ],
  },
  {
    source: {
      id: "src-api-risk",
      slug: "api-risk",
      title: "API Risk Ranking",
      summary: "Heuristics for ranking API surfaces before review.",
      createdAt: seedDate,
    },
    chunks: [
      {
        id: "chunk-api-endpoints",
        title: "Endpoint ranking",
        content:
          "Prioritize API endpoints that expose object identifiers, invoices, exports, admin actions, team membership, webhooks, billing, file downloads, or state-changing methods such as POST, PUT, PATCH, and DELETE.",
        keywords: ["api", "idor", "invoice", "admin", "webhook", "billing"],
      },
      {
        id: "chunk-rate-limit",
        title: "Rate-limit review",
        content:
          "Rate-limit testing should be bounded, low-noise, and tied to documented program rules. Prefer manual or tiny controlled checks on owned accounts instead of abusive automation.",
        keywords: ["rate", "limit", "otp", "login", "automation"],
      },
    ],
  },
  {
    source: {
      id: "src-report-writing",
      slug: "report-writing",
      title: "Report Writing",
      summary: "Evidence-first vulnerability report structure.",
      createdAt: seedDate,
    },
    chunks: [
      {
        id: "chunk-report-structure",
        title: "Report structure",
        content:
          "A strong vulnerability report includes title, affected asset, preconditions, reproduction steps, expected behavior, actual behavior, impact, redacted evidence, and remediation. Do not invent impact beyond the evidence.",
        keywords: ["report", "impact", "remediation", "steps", "evidence"],
      },
    ],
  },
];

let memoryStore: StoreShape | null = null;

function emptyStore(): StoreShape {
  return {
    conversations: [],
    messages: [],
    memoryCandidates: [],
    memories: [],
    knowledgeSources: seededKnowledge.map((item) => item.source),
    knowledgeChunks: seededKnowledge.flatMap((item) =>
      item.chunks.map((chunk) => ({
        ...chunk,
        sourceId: item.source.id,
        createdAt: seedDate,
      })),
    ),
    agentRuns: [],
  };
}

function storePath() {
  return path.join(process.cwd(), ".data", "ai-workspace.json");
}

async function loadJsonStore() {
  if (memoryStore) return memoryStore;
  try {
    const parsed = JSON.parse(await readFile(storePath(), "utf8")) as Partial<StoreShape>;
    memoryStore = {
      ...emptyStore(),
      conversations: parsed.conversations ?? [],
      messages: parsed.messages ?? [],
      memoryCandidates: parsed.memoryCandidates ?? [],
      memories: parsed.memories ?? [],
      knowledgeSources: mergeById(emptyStore().knowledgeSources, parsed.knowledgeSources ?? []),
      knowledgeChunks: mergeById(emptyStore().knowledgeChunks, parsed.knowledgeChunks ?? []),
      agentRuns: parsed.agentRuns ?? [],
    };
  } catch {
    memoryStore = emptyStore();
  }
  return memoryStore;
}

function mergeById<T extends { id: string }>(base: T[], extra: T[]) {
  const map = new Map(base.map((item) => [item.id, item]));
  for (const item of extra) map.set(item.id, item);
  return [...map.values()];
}

async function saveJsonStore(store: StoreShape) {
  await mkdir(path.dirname(storePath()), { recursive: true });
  await writeFile(storePath(), JSON.stringify(store, null, 2), "utf8");
  memoryStore = store;
}

async function ensurePg(pool: Queryable) {
  await pool.query(`
    create table if not exists ai_conversations (
      id text primary key,
      user_id text not null,
      title text not null,
      agent_id text not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    );
  `);
  await pool.query(`
    create table if not exists ai_messages (
      id text primary key,
      conversation_id text not null,
      user_id text not null,
      role text not null,
      content text not null,
      provider_label text,
      provider text,
      fallback boolean,
      created_at timestamptz not null
    );
  `);
  await pool.query(`
    create table if not exists ai_memory_candidates (
      id text primary key,
      user_id text not null,
      conversation_id text not null,
      message_id text,
      content text not null,
      reason text not null,
      status text not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    );
  `);
  await pool.query(`
    create table if not exists ai_memories (
      id text primary key,
      user_id text not null,
      content text not null,
      source_candidate_id text,
      created_at timestamptz not null,
      updated_at timestamptz not null
    );
  `);
  await pool.query(`
    create table if not exists ai_knowledge_sources (
      id text primary key,
      slug text not null unique,
      title text not null,
      summary text not null,
      created_at timestamptz not null
    );
  `);
  await pool.query(`
    create table if not exists ai_knowledge_chunks (
      id text primary key,
      source_id text not null,
      title text not null,
      content text not null,
      keywords text not null,
      created_at timestamptz not null
    );
  `);
  await pool.query(`
    create table if not exists ai_agent_runs (
      id text primary key,
      user_id text not null,
      conversation_id text not null,
      agent_id text not null,
      provider_label text not null,
      fallback boolean not null,
      created_at timestamptz not null
    );
  `);
  await pool.query("create index if not exists ai_conversations_user_idx on ai_conversations(user_id, updated_at desc)");
  await pool.query("create index if not exists ai_messages_conversation_idx on ai_messages(conversation_id, created_at)");
  await pool.query("create index if not exists ai_memory_candidates_user_idx on ai_memory_candidates(user_id, status)");
  await pool.query("create index if not exists ai_memories_user_idx on ai_memories(user_id)");
  await seedPgKnowledge(pool);
}

async function seedPgKnowledge(pool: Queryable) {
  for (const item of seededKnowledge) {
    await pool.query(
      `insert into ai_knowledge_sources (id, slug, title, summary, created_at)
       values ($1,$2,$3,$4,$5)
       on conflict (id) do nothing`,
      [item.source.id, item.source.slug, item.source.title, item.source.summary, item.source.createdAt],
    );
    for (const chunk of item.chunks) {
      await pool.query(
        `insert into ai_knowledge_chunks (id, source_id, title, content, keywords, created_at)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (id) do nothing`,
        [chunk.id, item.source.id, chunk.title, chunk.content, chunk.keywords.join(","), seedDate],
      );
    }
  }
}

function rowToConversation(row: Record<string, unknown>): AiConversation {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    agentId: getAiAgent(String(row.agent_id)).id,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function rowToMessage(row: Record<string, unknown>): AiMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    userId: String(row.user_id),
    role: row.role === "assistant" ? "assistant" : "user",
    content: String(row.content),
    providerLabel: row.provider_label ? String(row.provider_label) : undefined,
    provider: row.provider ? String(row.provider) : undefined,
    fallback: typeof row.fallback === "boolean" ? row.fallback : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function rowToMemoryCandidate(row: Record<string, unknown>): AiMemoryCandidate {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    conversationId: String(row.conversation_id),
    messageId: row.message_id ? String(row.message_id) : undefined,
    content: String(row.content),
    reason: String(row.reason),
    status: parseMemoryCandidateStatus(row.status),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function rowToMemory(row: Record<string, unknown>): AiMemory {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    content: String(row.content),
    sourceCandidateId: row.source_candidate_id ? String(row.source_candidate_id) : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function rowToKnowledgeChunk(row: Record<string, unknown>): AiKnowledgeChunk {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    title: String(row.title),
    content: String(row.content),
    keywords: String(row.keywords ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function parseMemoryCandidateStatus(status: unknown): AiMemoryCandidateStatus {
  if (status === "approved" || status === "deleted") return status;
  return "pending";
}

export function deriveConversationTitle(message: string) {
  const compact = message
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}_\s:/.-]/gu, "")
    .trim();
  if (!compact) return "New security chat";
  return compact.length > 54 ? `${compact.slice(0, 51)}...` : compact;
}

export function suggestMemoryFromMessage(message: string) {
  const compact = message.replace(/\s+/g, " ").trim();
  if (compact.length < 24 || compact.length > 260) return null;
  if (/(password|private key|secret|bearer|api[_ -]?key|sk-[a-z0-9]|mnemonic|seed phrase)/i.test(compact)) return null;
  const patterns = [
    { pattern: /\b(remember|save this|keep in mind)\b/i, reason: "The user explicitly asked to remember this." },
    { pattern: /\b(my|our)\s+(project|app|site|platform|domain|stack|workflow)\b/i, reason: "This looks like stable project context." },
    { pattern: /\b(i prefer|we prefer|default to|always use|avoid)\b/i, reason: "This looks like a reusable working preference." },
    { pattern: /\b(scope|program rules|authorized assets|out of scope)\b/i, reason: "This may be reusable authorization context." },
  ];
  const match = patterns.find((item) => item.pattern.test(compact));
  if (!match) return null;
  return { content: compact, reason: match.reason };
}

export async function createConversation(input: { userId: string; agentId?: string; title?: string }) {
  const now = new Date().toISOString();
  const agent = getAiAgent(input.agentId);
  const conversation: AiConversation = {
    id: crypto.randomUUID(),
    userId: input.userId,
    title: input.title?.trim() || "New security chat",
    agentId: agent.id,
    createdAt: now,
    updatedAt: now,
  };

  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    await pool.query(
      `insert into ai_conversations (id, user_id, title, agent_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [conversation.id, conversation.userId, conversation.title, conversation.agentId, conversation.createdAt, conversation.updatedAt],
    );
    return conversation;
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  store.conversations.push(conversation);
  await saveJsonStore(store);
  return conversation;
}

export async function listConversations(userId: string) {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query("select * from ai_conversations where user_id = $1 order by updated_at desc limit 100", [userId]);
    return result.rows.map(rowToConversation);
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  return store.conversations
    .filter((conversation) => conversation.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 100);
}

export async function getConversationForUser(userId: string, conversationId: string) {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query("select * from ai_conversations where id = $1 and user_id = $2", [conversationId, userId]);
    return result.rows[0] ? rowToConversation(result.rows[0]) : null;
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  return store.conversations.find((conversation) => conversation.id === conversationId && conversation.userId === userId) ?? null;
}

export async function appendMessage(input: {
  userId: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  providerLabel?: string;
  provider?: string;
  fallback?: boolean;
}) {
  const now = new Date().toISOString();
  const message: AiMessage = {
    id: crypto.randomUUID(),
    userId: input.userId,
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    providerLabel: input.providerLabel,
    provider: input.provider,
    fallback: input.fallback,
    createdAt: now,
  };

  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    await pool.query("begin");
    try {
      await pool.query(
        `insert into ai_messages (id, conversation_id, user_id, role, content, provider_label, provider, fallback, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          message.id,
          message.conversationId,
          message.userId,
          message.role,
          message.content,
          message.providerLabel ?? null,
          message.provider ?? null,
          message.fallback ?? null,
          message.createdAt,
        ],
      );
      const title = input.role === "user" ? deriveConversationTitle(input.content) : null;
      await pool.query(
        `update ai_conversations
         set updated_at = $1, title = case when title = 'New security chat' and $2::text is not null then $2 else title end
         where id = $3 and user_id = $4`,
        [now, title, input.conversationId, input.userId],
      );
      await pool.query("commit");
      return message;
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  store.messages.push(message);
  store.conversations = store.conversations.map((conversation) =>
    conversation.id === input.conversationId && conversation.userId === input.userId
      ? {
          ...conversation,
          title:
            conversation.title === "New security chat" && input.role === "user"
              ? deriveConversationTitle(input.content)
              : conversation.title,
          updatedAt: now,
        }
      : conversation,
  );
  await saveJsonStore(store);
  return message;
}

export async function listMessagesForConversation(userId: string, conversationId: string) {
  const conversation = await getConversationForUser(userId, conversationId);
  if (!conversation) return null;

  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query("select * from ai_messages where conversation_id = $1 and user_id = $2 order by created_at asc", [
      conversationId,
      userId,
    ]);
    return result.rows.map(rowToMessage);
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  return store.messages
    .filter((message) => message.conversationId === conversationId && message.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createMemoryCandidate(input: {
  userId: string;
  conversationId: string;
  messageId?: string;
  content: string;
  reason: string;
}) {
  const now = new Date().toISOString();
  const candidate: AiMemoryCandidate = {
    id: crypto.randomUUID(),
    userId: input.userId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    content: input.content,
    reason: input.reason,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    await pool.query(
      `insert into ai_memory_candidates (id, user_id, conversation_id, message_id, content, reason, status, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        candidate.id,
        candidate.userId,
        candidate.conversationId,
        candidate.messageId ?? null,
        candidate.content,
        candidate.reason,
        candidate.status,
        candidate.createdAt,
        candidate.updatedAt,
      ],
    );
    return candidate;
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  store.memoryCandidates.push(candidate);
  await saveJsonStore(store);
  return candidate;
}

export async function listMemoryCandidates(userId: string, status: AiMemoryCandidateStatus = "pending") {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query(
      "select * from ai_memory_candidates where user_id = $1 and status = $2 order by created_at desc limit 50",
      [userId, status],
    );
    return result.rows.map(rowToMemoryCandidate);
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  return store.memoryCandidates
    .filter((candidate) => candidate.userId === userId && candidate.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
}

export async function listMemories(userId: string) {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query("select * from ai_memories where user_id = $1 order by updated_at desc limit 100", [userId]);
    return result.rows.map(rowToMemory);
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  return store.memories
    .filter((memory) => memory.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 100);
}

export async function approveMemoryCandidate(userId: string, candidateId: string) {
  const now = new Date().toISOString();
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const existing = await pool.query("select * from ai_memory_candidates where id = $1 and user_id = $2", [candidateId, userId]);
    if (!existing.rows[0]) return null;
    const candidate = rowToMemoryCandidate(existing.rows[0]);
    const memory: AiMemory = {
      id: crypto.randomUUID(),
      userId,
      content: candidate.content,
      sourceCandidateId: candidate.id,
      createdAt: now,
      updatedAt: now,
    };
    await pool.query("begin");
    try {
      await pool.query("update ai_memory_candidates set status = 'approved', updated_at = $1 where id = $2 and user_id = $3", [
        now,
        candidateId,
        userId,
      ]);
      await pool.query(
        `insert into ai_memories (id, user_id, content, source_candidate_id, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6)`,
        [memory.id, memory.userId, memory.content, memory.sourceCandidateId ?? null, memory.createdAt, memory.updatedAt],
      );
      await pool.query("commit");
      return memory;
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  const candidate = store.memoryCandidates.find((item) => item.id === candidateId && item.userId === userId);
  if (!candidate) return null;
  candidate.status = "approved";
  candidate.updatedAt = now;
  const memory: AiMemory = {
    id: crypto.randomUUID(),
    userId,
    content: candidate.content,
    sourceCandidateId: candidate.id,
    createdAt: now,
    updatedAt: now,
  };
  store.memories.push(memory);
  await saveJsonStore(store);
  return memory;
}

export async function deleteMemoryCandidate(userId: string, candidateId: string) {
  const now = new Date().toISOString();
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query(
      "update ai_memory_candidates set status = 'deleted', updated_at = $1 where id = $2 and user_id = $3 returning id",
      [now, candidateId, userId],
    );
    return result.rows.length > 0;
  });
  if (pgResult !== null) return pgResult;

  const store = await loadJsonStore();
  const candidate = store.memoryCandidates.find((item) => item.id === candidateId && item.userId === userId);
  if (!candidate) return false;
  candidate.status = "deleted";
  candidate.updatedAt = now;
  await saveJsonStore(store);
  return true;
}

export async function searchAiContext(userId: string, query: string, limit = 6) {
  const [memories, chunks] = await Promise.all([listMemories(userId), listKnowledgeChunks()]);
  const matches: AiContextMatch[] = [
    ...memories.map((memory) => ({
      type: "memory" as const,
      title: "User-approved memory",
      content: memory.content,
      score: scoreText(query, `${memory.content} user memory preference context`),
    })),
    ...chunks.map((chunk) => ({
      type: "knowledge" as const,
      title: chunk.title,
      content: chunk.content,
      score: scoreText(query, `${chunk.title} ${chunk.content} ${chunk.keywords.join(" ")}`),
    })),
  ];

  return matches
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function listKnowledgeChunks() {
  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    const result = await pool.query("select * from ai_knowledge_chunks order by created_at asc");
    return result.rows.map(rowToKnowledgeChunk);
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  return store.knowledgeChunks;
}

function scoreText(query: string, haystack: string) {
  const terms = tokenize(query);
  if (!terms.length) return 0;
  const lower = haystack.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function tokenize(text: string) {
  const stop = new Set(["the", "and", "for", "with", "this", "that", "from", "into", "على", "من", "في", "عن"]);
  return Array.from(new Set((text.toLowerCase().match(/[a-z0-9_./:-]{3,}|[\u0600-\u06ff]{3,}/g) ?? []).filter((term) => !stop.has(term))));
}

export function formatAiContext(matches: AiContextMatch[]) {
  if (!matches.length) return "";
  return matches.map((match, index) => `[${index + 1}] ${match.type.toUpperCase()} - ${match.title}\n${match.content}`).join("\n\n");
}

export async function recordAgentRun(input: {
  userId: string;
  conversationId: string;
  agentId?: string;
  providerLabel: string;
  fallback: boolean;
}) {
  const run: AiAgentRun = {
    id: crypto.randomUUID(),
    userId: input.userId,
    conversationId: input.conversationId,
    agentId: getAiAgent(input.agentId ?? defaultAgentId).id,
    providerLabel: input.providerLabel,
    fallback: input.fallback,
    createdAt: new Date().toISOString(),
  };

  const pgResult = await withPg(async (pool) => {
    await ensurePg(pool);
    await pool.query(
      `insert into ai_agent_runs (id, user_id, conversation_id, agent_id, provider_label, fallback, created_at)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [run.id, run.userId, run.conversationId, run.agentId, run.providerLabel, run.fallback, run.createdAt],
    );
    return run;
  });
  if (pgResult) return pgResult;

  const store = await loadJsonStore();
  store.agentRuns.push(run);
  await saveJsonStore(store);
  return run;
}
