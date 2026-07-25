import { createHash, randomUUID } from 'node:crypto';

export const MEMORY_KINDS = Object.freeze([
  'working',
  'episodic',
  'semantic',
  'procedural',
]);

export const RUN_OUTCOMES = Object.freeze([
  'success',
  'failure',
  'cancelled',
  'partial',
]);

const MEMORY_KIND_SET = new Set(MEMORY_KINDS);
const RUN_OUTCOME_SET = new Set(RUN_OUTCOMES);
const MAX_TEXT_LENGTH = 32_000;
const MAX_TAGS = 32;
const MAX_TOOL_CALLS = 256;
const MAX_SKILLS = 64;
const DEFAULT_WORKING_TTL_MS = 24 * 60 * 60 * 1000;
const SECRET_FIELD_PATTERN = /(api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret|authorization|cookie|private[_-]?key|credential)/i;
const SECRET_TEXT_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bsk-proj-[A-Za-z0-9_-]{12,}\b/g,
  /\bsk-or-v1-[A-Za-z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi,
  /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?):\/\/[^\s]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

function assertNonEmptyString(value, field, maxLength = 256) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`${field} must be a non-empty string up to ${maxLength} characters`);
  }
  return value.trim();
}

function assertSafeTimestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }
  return value;
}

function normalizeScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new Error('scope is required');
  }
  return Object.freeze({
    userId: assertNonEmptyString(scope.userId, 'scope.userId'),
    projectId: assertNonEmptyString(scope.projectId, 'scope.projectId'),
  });
}

function scopeKey(scope) {
  return `${scope.userId}\u0000${scope.projectId}`;
}

function normalizeTags(tags = []) {
  if (!Array.isArray(tags) || tags.length > MAX_TAGS) {
    throw new Error(`tags must be an array with at most ${MAX_TAGS} entries`);
  }
  const result = [];
  for (const tag of tags) {
    const normalized = assertNonEmptyString(tag, 'tag', 64).toLowerCase();
    if (!result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return Object.freeze(result);
}

function redactText(value) {
  let output = value;
  for (const pattern of SECRET_TEXT_PATTERNS) {
    output = output.replace(pattern, '[REDACTED]');
  }
  return output;
}

export function sanitizeForMemory(value, { depth = 0 } = {}) {
  if (depth > 8) {
    return '[TRUNCATED]';
  }
  if (value === null || value === undefined) {
    return value ?? null;
  }
  if (typeof value === 'string') {
    return redactText(value).slice(0, MAX_TEXT_LENGTH);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 256).map((entry) => sanitizeForMemory(entry, { depth: depth + 1 }));
  }
  if (typeof value === 'object') {
    const output = {};
    for (const [key, entry] of Object.entries(value).slice(0, 256)) {
      output[key] = SECRET_FIELD_PATTERN.test(key)
        ? '[REDACTED]'
        : sanitizeForMemory(entry, { depth: depth + 1 });
    }
    return output;
  }
  return String(value).slice(0, 1024);
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function contentHash(record) {
  return createHash('sha256')
    .update(stableJson({
      scope: record.scope,
      kind: record.kind,
      text: record.text,
      data: record.data,
      tags: record.tags,
      sourceRefs: record.sourceRefs,
    }))
    .digest('hex');
}

function normalizeSourceRefs(sourceRefs = []) {
  if (!Array.isArray(sourceRefs) || sourceRefs.length > 32) {
    throw new Error('sourceRefs must be an array with at most 32 entries');
  }
  return Object.freeze(sourceRefs.map((source, index) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error(`sourceRefs[${index}] must be an object`);
    }
    return Object.freeze({
      type: assertNonEmptyString(source.type, `sourceRefs[${index}].type`, 64),
      id: assertNonEmptyString(source.id, `sourceRefs[${index}].id`, 512),
      version: source.version == null ? null : assertNonEmptyString(source.version, `sourceRefs[${index}].version`, 128),
    });
  }));
}

function normalizeConfidence(value = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('confidence must be between 0 and 1');
  }
  return value;
}

function normalizeTtl(kind, ttlMs) {
  if (ttlMs === null) {
    return null;
  }
  const resolved = ttlMs === undefined && kind === 'working' ? DEFAULT_WORKING_TTL_MS : ttlMs;
  if (resolved === undefined) {
    return null;
  }
  if (!Number.isSafeInteger(resolved) || resolved < 1_000 || resolved > 10 * 365 * 24 * 60 * 60 * 1000) {
    throw new Error('ttlMs is outside the supported range');
  }
  return resolved;
}

function tokenize(value) {
  return new Set(
    value
      .toLocaleLowerCase('en-US')
      .split(/[^\p{L}\p{N}_-]+/u)
      .filter((token) => token.length >= 2)
      .slice(0, 256),
  );
}

function lexicalScore(record, queryTokens) {
  if (queryTokens.size === 0) {
    return 0;
  }
  const haystack = tokenize(`${record.text}\n${record.tags.join(' ')}\n${stableJson(record.data)}`);
  let matches = 0;
  for (const token of queryTokens) {
    if (haystack.has(token)) {
      matches += 1;
    }
  }
  return matches / queryTokens.size;
}

function clone(value) {
  return structuredClone(value);
}

function freezeRecord(value) {
  return Object.freeze(value);
}

export class AgentMemoryLedger {
  #memories = new Map();
  #memoryIdsByScope = new Map();
  #hashesByScope = new Map();
  #runs = new Map();
  #runIdsByScope = new Map();
  #audit = [];

  addMemory(input, { now = Date.now() } = {}) {
    assertSafeTimestamp(now, 'now');
    const scope = normalizeScope(input.scope);
    const kind = assertNonEmptyString(input.kind, 'kind', 32);
    if (!MEMORY_KIND_SET.has(kind)) {
      throw new Error(`Unsupported memory kind: ${kind}`);
    }
    const text = redactText(assertNonEmptyString(input.text, 'text', MAX_TEXT_LENGTH));
    const data = sanitizeForMemory(input.data ?? {});
    const tags = normalizeTags(input.tags);
    const sourceRefs = normalizeSourceRefs(input.sourceRefs);
    const confidence = normalizeConfidence(input.confidence);
    const ttlMs = normalizeTtl(kind, input.ttlMs);
    const expiresAt = ttlMs == null ? null : now + ttlMs;

    const candidate = {
      scope,
      kind,
      text,
      data,
      tags,
      sourceRefs,
    };
    const hash = contentHash(candidate);
    const key = scopeKey(scope);
    const hashes = this.#hashesByScope.get(key) ?? new Map();
    const duplicateId = hashes.get(hash);
    if (duplicateId) {
      const existing = this.#memories.get(duplicateId);
      if (existing && existing.deletedAt == null && (existing.expiresAt == null || existing.expiresAt > now)) {
        return clone(existing);
      }
    }

    const record = freezeRecord({
      id: randomUUID(),
      ...candidate,
      confidence,
      pinned: Boolean(input.pinned),
      createdAt: now,
      updatedAt: now,
      expiresAt,
      deletedAt: null,
      supersedesId: input.supersedesId ?? null,
      contentHash: hash,
    });
    this.#memories.set(record.id, record);
    const ids = this.#memoryIdsByScope.get(key) ?? [];
    ids.push(record.id);
    this.#memoryIdsByScope.set(key, ids);
    hashes.set(hash, record.id);
    this.#hashesByScope.set(key, hashes);
    this.#auditEvent('memory.added', scope, record.id, now, { kind });
    return clone(record);
  }

  correctMemory(id, scopeInput, patch, { now = Date.now() } = {}) {
    const scope = normalizeScope(scopeInput);
    const current = this.#requireMemory(id, scope);
    this.deleteMemory(id, scope, { now, hard: false, reason: 'superseded' });
    return this.addMemory({
      scope,
      kind: patch.kind ?? current.kind,
      text: patch.text ?? current.text,
      data: patch.data ?? current.data,
      tags: patch.tags ?? current.tags,
      sourceRefs: patch.sourceRefs ?? current.sourceRefs,
      confidence: patch.confidence ?? current.confidence,
      pinned: patch.pinned ?? current.pinned,
      ttlMs: patch.ttlMs ?? (current.expiresAt == null ? null : Math.max(1_000, current.expiresAt - now)),
      supersedesId: current.id,
    }, { now });
  }

  setPinned(id, scopeInput, pinned, { now = Date.now() } = {}) {
    const scope = normalizeScope(scopeInput);
    const current = this.#requireMemory(id, scope);
    if (current.deletedAt != null) {
      throw new Error('Deleted memory cannot be pinned');
    }
    const updated = freezeRecord({ ...current, pinned: Boolean(pinned), updatedAt: now });
    this.#memories.set(id, updated);
    this.#auditEvent('memory.pin_changed', scope, id, now, { pinned: updated.pinned });
    return clone(updated);
  }

  retrieve({ scope: scopeInput, query = '', kinds, tags, limit = 20, now = Date.now() }) {
    const scope = normalizeScope(scopeInput);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('limit must be between 1 and 100');
    }
    const kindFilter = kinds == null ? null : new Set(kinds);
    if (kindFilter && [...kindFilter].some((kind) => !MEMORY_KIND_SET.has(kind))) {
      throw new Error('kinds contains an unsupported memory kind');
    }
    const tagFilter = tags == null ? null : new Set(normalizeTags(tags));
    const queryTokens = tokenize(query);
    const ids = this.#memoryIdsByScope.get(scopeKey(scope)) ?? [];
    const results = [];

    for (const id of ids) {
      const record = this.#memories.get(id);
      if (!record || record.deletedAt != null || (record.expiresAt != null && record.expiresAt <= now)) {
        continue;
      }
      if (kindFilter && !kindFilter.has(record.kind)) {
        continue;
      }
      if (tagFilter && [...tagFilter].some((tag) => !record.tags.includes(tag))) {
        continue;
      }
      const score = queryTokens.size === 0 ? 0 : lexicalScore(record, queryTokens);
      if (queryTokens.size > 0 && score === 0) {
        continue;
      }
      results.push({
        record,
        score: score + (record.pinned ? 1 : 0) + record.confidence * 0.1,
      });
    }

    results.sort((a, b) => b.score - a.score || b.record.updatedAt - a.record.updatedAt);
    return results.slice(0, limit).map(({ record, score }) => ({ ...clone(record), retrievalScore: score }));
  }

  deleteMemory(id, scopeInput, { now = Date.now(), hard = false, reason = 'user_request' } = {}) {
    const scope = normalizeScope(scopeInput);
    const current = this.#requireMemory(id, scope);
    if (hard) {
      this.#memories.delete(id);
      const key = scopeKey(scope);
      this.#memoryIdsByScope.set(key, (this.#memoryIdsByScope.get(key) ?? []).filter((candidate) => candidate !== id));
      this.#hashesByScope.get(key)?.delete(current.contentHash);
      this.#auditEvent('memory.hard_deleted', scope, id, now, { reason });
      return { id, hardDeleted: true };
    }
    const updated = freezeRecord({ ...current, deletedAt: now, updatedAt: now });
    this.#memories.set(id, updated);
    this.#auditEvent('memory.deleted', scope, id, now, { reason });
    return clone(updated);
  }

  purgeExpired({ now = Date.now(), scope: scopeInput } = {}) {
    assertSafeTimestamp(now, 'now');
    const scope = scopeInput == null ? null : normalizeScope(scopeInput);
    let purged = 0;
    for (const record of [...this.#memories.values()]) {
      if (scope && scopeKey(record.scope) !== scopeKey(scope)) {
        continue;
      }
      if (record.expiresAt != null && record.expiresAt <= now) {
        this.deleteMemory(record.id, record.scope, { now, hard: true, reason: 'expired' });
        purged += 1;
      }
    }
    return purged;
  }

  appendRun(input, { now = Date.now() } = {}) {
    const scope = normalizeScope(input.scope);
    const outcome = assertNonEmptyString(input.outcome, 'outcome', 32);
    if (!RUN_OUTCOME_SET.has(outcome)) {
      throw new Error(`Unsupported run outcome: ${outcome}`);
    }
    const startedAt = assertSafeTimestamp(input.startedAt ?? now, 'startedAt');
    const completedAt = assertSafeTimestamp(input.completedAt ?? now, 'completedAt');
    if (completedAt < startedAt) {
      throw new Error('completedAt cannot be before startedAt');
    }
    const skills = normalizeStringArray(input.skills, MAX_SKILLS, 'skills');
    const tools = normalizeToolCalls(input.tools);
    const cost = input.cost == null ? null : normalizeNonNegativeNumber(input.cost, 'cost');
    const retries = input.retries == null ? 0 : normalizeNonNegativeInteger(input.retries, 'retries', 100);
    const feedback = input.feedback == null ? null : sanitizeForMemory(input.feedback);

    const record = freezeRecord({
      id: randomUUID(),
      scope,
      intent: assertNonEmptyString(input.intent, 'intent', 256),
      agent: assertNonEmptyString(input.agent, 'agent', 128),
      skills,
      tools,
      outcome,
      provider: input.provider == null ? null : assertNonEmptyString(input.provider, 'provider', 128),
      model: input.model == null ? null : assertNonEmptyString(input.model, 'model', 256),
      startedAt,
      completedAt,
      latencyMs: completedAt - startedAt,
      cost,
      retries,
      feedback,
      error: input.error == null ? null : sanitizeForMemory(input.error),
      metadata: sanitizeForMemory(input.metadata ?? {}),
      createdAt: now,
    });
    this.#runs.set(record.id, record);
    const key = scopeKey(scope);
    const ids = this.#runIdsByScope.get(key) ?? [];
    ids.push(record.id);
    this.#runIdsByScope.set(key, ids);
    this.#auditEvent('run.appended', scope, record.id, now, { outcome });
    return clone(record);
  }

  listRuns({ scope: scopeInput, limit = 50, outcome } = {}) {
    const scope = normalizeScope(scopeInput);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new Error('limit must be between 1 and 500');
    }
    if (outcome != null && !RUN_OUTCOME_SET.has(outcome)) {
      throw new Error('Unsupported run outcome filter');
    }
    const ids = this.#runIdsByScope.get(scopeKey(scope)) ?? [];
    return ids
      .map((id) => this.#runs.get(id))
      .filter((record) => record && (outcome == null || record.outcome === outcome))
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit)
      .map(clone);
  }

  exportScope(scopeInput, { now = Date.now() } = {}) {
    const scope = normalizeScope(scopeInput);
    return {
      version: 1,
      exportedAt: now,
      scope,
      memories: this.retrieve({ scope, limit: 100, now }),
      runs: this.listRuns({ scope, limit: 500 }),
      audit: this.#audit.filter((event) => scopeKey(event.scope) === scopeKey(scope)).map(clone),
    };
  }

  getAudit({ scope: scopeInput, limit = 100 } = {}) {
    const scope = normalizeScope(scopeInput);
    return this.#audit
      .filter((event) => scopeKey(event.scope) === scopeKey(scope))
      .slice(-limit)
      .map(clone);
  }

  #requireMemory(id, scope) {
    const record = this.#memories.get(id);
    if (!record || scopeKey(record.scope) !== scopeKey(scope)) {
      throw new Error('Memory was not found in this scope');
    }
    return record;
  }

  #auditEvent(action, scope, targetId, timestamp, detail) {
    this.#audit.push(freezeRecord({
      id: randomUUID(),
      action,
      scope,
      targetId,
      timestamp,
      detail: sanitizeForMemory(detail),
    }));
    if (this.#audit.length > 100_000) {
      this.#audit.splice(0, this.#audit.length - 100_000);
    }
  }
}

function normalizeStringArray(value = [], maximum, field) {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error(`${field} must be an array with at most ${maximum} entries`);
  }
  return Object.freeze(value.map((entry, index) => assertNonEmptyString(entry, `${field}[${index}]`, 128)));
}

function normalizeToolCalls(value = []) {
  if (!Array.isArray(value) || value.length > MAX_TOOL_CALLS) {
    throw new Error(`tools must be an array with at most ${MAX_TOOL_CALLS} entries`);
  }
  return Object.freeze(value.map((tool, index) => {
    if (!tool || typeof tool !== 'object' || Array.isArray(tool)) {
      throw new Error(`tools[${index}] must be an object`);
    }
    return Object.freeze({
      name: assertNonEmptyString(tool.name, `tools[${index}].name`, 128),
      outcome: tool.outcome == null ? null : assertNonEmptyString(tool.outcome, `tools[${index}].outcome`, 32),
      durationMs: tool.durationMs == null ? null : normalizeNonNegativeInteger(tool.durationMs, `tools[${index}].durationMs`, 24 * 60 * 60 * 1000),
      metadata: sanitizeForMemory(tool.metadata ?? {}),
    });
  }));
}

function normalizeNonNegativeNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative finite number`);
  }
  return value;
}

function normalizeNonNegativeInteger(value, field, maximum) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${field} must be a non-negative safe integer up to ${maximum}`);
  }
  return value;
}
