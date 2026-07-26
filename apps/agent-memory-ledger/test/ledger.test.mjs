import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentMemoryLedger,
  MongoMemoryStorageAdapter,
  PgVectorMemoryRetrievalAdapter,
  sanitizeForMemory,
} from '../src/index.mjs';

const aliceAlpha = Object.freeze({ userId: 'alice', projectId: 'alpha' });
const aliceBeta = Object.freeze({ userId: 'alice', projectId: 'beta' });
const bobAlpha = Object.freeze({ userId: 'bob', projectId: 'alpha' });

test('memory retrieval is isolated by user and project', () => {
  const ledger = new AgentMemoryLedger();
  ledger.addMemory({ scope: aliceAlpha, kind: 'semantic', text: 'Alpha uses Railway', tags: ['deploy'] }, { now: 1000 });
  ledger.addMemory({ scope: aliceBeta, kind: 'semantic', text: 'Beta uses Docker', tags: ['deploy'] }, { now: 1000 });
  ledger.addMemory({ scope: bobAlpha, kind: 'semantic', text: 'Bob owns Alpha', tags: ['owner'] }, { now: 1000 });

  assert.deepEqual(ledger.retrieve({ scope: aliceAlpha, query: 'Railway', now: 2000 }).map((m) => m.text), ['Alpha uses Railway']);
  assert.equal(ledger.retrieve({ scope: aliceAlpha, query: 'Docker', now: 2000 }).length, 0);
  assert.equal(ledger.retrieve({ scope: aliceAlpha, query: 'Bob', now: 2000 }).length, 0);
});

test('secrets are redacted from text, nested data, tool metadata, and errors', () => {
  const ledger = new AgentMemoryLedger();
  const memory = ledger.addMemory({
    scope: aliceAlpha,
    kind: 'episodic',
    text: 'Used sk-proj-ABCDEFGHIJKLMNOPQRST to call API',
    data: {
      password: 'super-secret',
      nested: { authorization: 'Bearer token.value.signature', safe: 'ok' },
      mongo: 'mongodb://user:pass@example/db',
    },
  }, { now: 1000 });

  assert.doesNotMatch(memory.text, /sk-proj/);
  assert.equal(memory.data.password, '[REDACTED]');
  assert.equal(memory.data.nested.authorization, '[REDACTED]');
  assert.equal(memory.data.nested.safe, 'ok');
  assert.equal(memory.data.mongo, '[REDACTED]');

  const run = ledger.appendRun({
    scope: aliceAlpha,
    intent: 'debug',
    agent: 'devops',
    outcome: 'failure',
    tools: [{ name: 'http', metadata: { apiKey: 'secret', url: 'safe' } }],
    error: { message: 'Bearer hidden-token-value', refreshToken: 'token' },
  }, { now: 2000 });
  assert.equal(run.tools[0].metadata.apiKey, '[REDACTED]');
  assert.equal(run.error.refreshToken, '[REDACTED]');
  assert.doesNotMatch(run.error.message, /hidden-token/);
});

test('working memory expires and purge removes it permanently', () => {
  const ledger = new AgentMemoryLedger();
  ledger.addMemory({
    scope: aliceAlpha,
    kind: 'working',
    text: 'Temporary deployment state',
    ttlMs: 1000,
  }, { now: 1000 });

  assert.equal(ledger.retrieve({ scope: aliceAlpha, now: 1999 }).length, 1);
  assert.equal(ledger.retrieve({ scope: aliceAlpha, now: 2000 }).length, 0);
  assert.equal(ledger.purgeExpired({ scope: aliceAlpha, now: 2000 }), 1);
  assert.equal(ledger.retrieve({ scope: aliceAlpha, now: 3000 }).length, 0);
});

test('duplicate live memories are deduplicated within the same scope', () => {
  const ledger = new AgentMemoryLedger();
  const first = ledger.addMemory({ scope: aliceAlpha, kind: 'semantic', text: 'Uses MongoDB', tags: ['db'] }, { now: 1000 });
  const second = ledger.addMemory({ scope: aliceAlpha, kind: 'semantic', text: 'Uses MongoDB', tags: ['db'] }, { now: 2000 });
  const otherScope = ledger.addMemory({ scope: bobAlpha, kind: 'semantic', text: 'Uses MongoDB', tags: ['db'] }, { now: 2000 });
  assert.equal(first.id, second.id);
  assert.notEqual(first.id, otherScope.id);
});

test('correction supersedes and hides the previous memory', () => {
  const ledger = new AgentMemoryLedger();
  const old = ledger.addMemory({ scope: aliceAlpha, kind: 'semantic', text: 'Port is 3000' }, { now: 1000 });
  const current = ledger.correctMemory(old.id, aliceAlpha, { text: 'Port is 3080' }, { now: 2000 });
  assert.equal(current.supersedesId, old.id);
  assert.deepEqual(ledger.retrieve({ scope: aliceAlpha, query: '3080', now: 3000 }).map((m) => m.id), [current.id]);
  assert.equal(ledger.retrieve({ scope: aliceAlpha, query: '3000', now: 3000 }).length, 0);
});

test('soft and hard deletion stop retrieval and enforce scope', () => {
  const ledger = new AgentMemoryLedger();
  const memory = ledger.addMemory({ scope: aliceAlpha, kind: 'procedural', text: 'Deploy safely' }, { now: 1000 });
  assert.throws(() => ledger.deleteMemory(memory.id, bobAlpha), /not found/);
  ledger.deleteMemory(memory.id, aliceAlpha, { now: 2000 });
  assert.equal(ledger.retrieve({ scope: aliceAlpha, now: 3000 }).length, 0);
  const hard = ledger.deleteMemory(memory.id, aliceAlpha, { now: 4000, hard: true });
  assert.deepEqual(hard, { id: memory.id, hardDeleted: true });
  assert.throws(() => ledger.setPinned(memory.id, aliceAlpha, true), /not found/);
});

test('retrieval respects kinds, tags, pins, and lexical relevance', () => {
  const ledger = new AgentMemoryLedger();
  const pinned = ledger.addMemory({
    scope: aliceAlpha,
    kind: 'procedural',
    text: 'Railway deployment checklist',
    tags: ['railway', 'deploy'],
    pinned: true,
  }, { now: 1000 });
  ledger.addMemory({
    scope: aliceAlpha,
    kind: 'semantic',
    text: 'Railway domain is private',
    tags: ['railway'],
  }, { now: 2000 });
  const results = ledger.retrieve({
    scope: aliceAlpha,
    query: 'Railway deployment',
    kinds: ['procedural'],
    tags: ['deploy'],
    now: 3000,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, pinned.id);
  assert.ok(results[0].retrievalScore > 1);
});

test('run ledger records metrics and remains scope-isolated', () => {
  const ledger = new AgentMemoryLedger();
  const run = ledger.appendRun({
    scope: aliceAlpha,
    intent: 'fix_deployment',
    agent: 'devops-monitor',
    skills: ['railway-debug', 'docker'],
    tools: [{ name: 'read_logs', outcome: 'success', durationMs: 120 }],
    outcome: 'success',
    provider: 'local',
    model: 'router-small',
    startedAt: 1000,
    completedAt: 2500,
    cost: 0,
    retries: 1,
    feedback: { rating: 1 },
  }, { now: 2500 });
  assert.equal(run.latencyMs, 1500);
  assert.equal(ledger.listRuns({ scope: aliceAlpha }).length, 1);
  assert.equal(ledger.listRuns({ scope: bobAlpha }).length, 0);
  assert.equal(ledger.listRuns({ scope: aliceAlpha, outcome: 'failure' }).length, 0);
});

test('export contains only the requested scope and an audit trail', () => {
  const ledger = new AgentMemoryLedger();
  ledger.addMemory({ scope: aliceAlpha, kind: 'semantic', text: 'Alpha fact' }, { now: 1000 });
  ledger.addMemory({ scope: bobAlpha, kind: 'semantic', text: 'Bob fact' }, { now: 1000 });
  ledger.appendRun({ scope: aliceAlpha, intent: 'answer', agent: 'general', outcome: 'success' }, { now: 2000 });
  const exported = ledger.exportScope(aliceAlpha, { now: 3000 });
  assert.deepEqual(exported.scope, aliceAlpha);
  assert.equal(exported.memories.length, 1);
  assert.equal(exported.runs.length, 1);
  assert.ok(exported.audit.length >= 2);
  assert.ok(exported.audit.every((event) => event.scope.userId === 'alice'));
});

function collection() {
  const rows = [];
  return {
    rows,
    async insertOne(document) {
      rows.push(structuredClone(document));
      return { insertedId: document.id };
    },
    async deleteMany(filter) {
      const before = rows.length;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (
          rows[index].scope.userId === filter['scope.userId'] &&
          rows[index].scope.projectId === filter['scope.projectId']
        ) {
          rows.splice(index, 1);
        }
      }
      return { deletedCount: before - rows.length };
    },
    find(filter) {
      return {
        async toArray() {
          return rows
            .filter((row) => (
              row.scope.userId === filter['scope.userId'] &&
              row.scope.projectId === filter['scope.projectId']
            ))
            .map((row) => structuredClone(row));
        },
      };
    },
  };
}

test('mongo adapter redacts, isolates, exports, and deletes scoped memory', async () => {
  const adapter = new MongoMemoryStorageAdapter({
    records: collection(),
    runs: collection(),
    audit: collection(),
  });
  await adapter.saveMemory({
    scope: aliceAlpha,
    kind: 'semantic',
    text: 'Use sk-proj-ABCDEFGHIJKLMNOPQRST',
    data: { password: 'secret', note: 'ok' },
  }, { now: 1000 });
  await adapter.saveMemory({ scope: bobAlpha, kind: 'semantic', text: 'Bob fact' }, { now: 1000 });
  const exported = await adapter.exportScope(aliceAlpha);

  assert.equal(exported.memories.length, 1);
  assert.doesNotMatch(exported.memories[0].text, /sk-proj/);
  assert.equal(exported.memories[0].data.password, '[REDACTED]');
  assert.equal(exported.memories[0].scope.userId, 'alice');
  assert.equal((await adapter.deleteScope(aliceAlpha)).memoriesDeleted, 1);
  assert.equal((await adapter.exportScope(aliceAlpha)).memories.length, 0);
});

test('pgvector adapter requires approved embeddings and scopes search', async () => {
  const calls = [];
  const adapter = new PgVectorMemoryRetrievalAdapter({
    client: {
      async query(sql, params) {
        calls.push({ sql, params });
        return { rows: [{ memory_id: 'memory-1', text: 'safe', metadata: { apiKey: 'secret' } }] };
      },
    },
  });

  await assert.rejects(() => adapter.search({ scope: aliceAlpha }), /embedding is required/);
  assert.throws(
    () => new PgVectorMemoryRetrievalAdapter({ client: { query() {} }, table: 'bad;drop' }),
    /safe SQL identifier/,
  );
  await adapter.upsertEmbedding({
    scope: aliceAlpha,
    memoryId: 'memory-1',
    embedding: [0.1, 0.2],
    metadata: { token: 'secret' },
  });
  const results = await adapter.search({ scope: aliceAlpha, embedding: [0.1, 0.2], limit: 5 });

  assert.equal(calls[0].params[0], 'alice');
  assert.equal(calls[0].params[1], 'alpha');
  assert.equal(calls[0].params[5].token, '[REDACTED]');
  assert.equal(results[0].metadata.apiKey, '[REDACTED]');
});

test('standalone sanitizer handles depth and unsupported values safely', () => {
  const value = sanitizeForMemory({ api_key: 'x', fn: () => true, plain: 'hello' });
  assert.equal(value.api_key, '[REDACTED]');
  assert.match(value.fn, /function|true/);
  assert.equal(value.plain, 'hello');
});
