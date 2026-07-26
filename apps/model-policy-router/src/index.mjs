import { createHash, randomUUID } from 'node:crypto';

export const PROVIDER_TIERS = Object.freeze(['local', 'free', 'premium']);
export const PROVIDER_HEALTH = Object.freeze(['healthy', 'degraded', 'down', 'quota_exhausted']);
export const DATA_CLASSES = Object.freeze(['public', 'internal', 'confidential', 'restricted']);
export const TASK_CAPABILITIES = Object.freeze([
  'chat',
  'reasoning',
  'code',
  'files',
  'vision',
  'tools',
  'embeddings',
  'summarization',
]);

const TIER_SET = new Set(PROVIDER_TIERS);
const HEALTH_SET = new Set(PROVIDER_HEALTH);
const DATA_CLASS_SET = new Set(DATA_CLASSES);
const CAPABILITY_SET = new Set(TASK_CAPABILITIES);
const DATA_RANK = new Map(DATA_CLASSES.map((value, index) => [value, index]));
const DEFAULT_TIER_ORDER = Object.freeze(['local', 'free', 'premium']);
const MAX_TRACE_REASONS = 128;

function assertString(value, field, max = 256) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new Error(`${field} must be a non-empty string up to ${max} characters`);
  }
  return value.trim();
}

function assertBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new Error(`${field} must be boolean`);
  }
  return value;
}

function normalizeScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new Error('scope is required');
  }
  return Object.freeze({
    userId: assertString(scope.userId, 'scope.userId'),
    projectId: assertString(scope.projectId, 'scope.projectId'),
  });
}

function scopeKey(scope) {
  return `${scope.userId}\u0000${scope.projectId}`;
}

function normalizeCapabilities(value, field = 'capabilities') {
  if (!Array.isArray(value) || value.length === 0 || value.length > TASK_CAPABILITIES.length) {
    throw new Error(`${field} must be a non-empty capability array`);
  }
  const result = [];
  for (const capability of value) {
    if (!CAPABILITY_SET.has(capability)) {
      throw new Error(`Unknown capability: ${capability}`);
    }
    if (!result.includes(capability)) {
      result.push(capability);
    }
  }
  return Object.freeze(result);
}

function normalizeDataClasses(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('allowedDataClasses must be a non-empty array');
  }
  const result = [];
  for (const dataClass of value) {
    if (!DATA_CLASS_SET.has(dataClass)) {
      throw new Error(`Unknown data class: ${dataClass}`);
    }
    if (!result.includes(dataClass)) {
      result.push(dataClass);
    }
  }
  return Object.freeze(result);
}

function normalizeProvider(input) {
  const id = assertString(input.id, 'provider.id', 128);
  const tier = assertString(input.tier, 'provider.tier', 32);
  const health = assertString(input.health ?? 'healthy', 'provider.health', 32);
  if (!TIER_SET.has(tier)) {
    throw new Error(`Unsupported provider tier: ${tier}`);
  }
  if (!HEALTH_SET.has(health)) {
    throw new Error(`Unsupported provider health: ${health}`);
  }
  const maxContextTokens = input.maxContextTokens ?? 8_192;
  if (!Number.isSafeInteger(maxContextTokens) || maxContextTokens < 512) {
    throw new Error('maxContextTokens must be an integer of at least 512');
  }
  const estimatedCostPerMillion = input.estimatedCostPerMillion ?? (tier === 'premium' ? null : 0);
  if (estimatedCostPerMillion !== null && (typeof estimatedCostPerMillion !== 'number' || !Number.isFinite(estimatedCostPerMillion) || estimatedCostPerMillion < 0)) {
    throw new Error('estimatedCostPerMillion must be null or a non-negative finite number');
  }
  return Object.freeze({
    id,
    label: assertString(input.label ?? id, 'provider.label', 128),
    tier,
    enabled: input.enabled === undefined ? true : assertBoolean(input.enabled, 'provider.enabled'),
    health,
    capabilities: normalizeCapabilities(input.capabilities),
    allowedDataClasses: normalizeDataClasses(input.allowedDataClasses ?? ['public']),
    maxContextTokens,
    estimatedCostPerMillion,
    qualityScore: normalizeScore(input.qualityScore ?? 0.5, 'qualityScore'),
    latencyScore: normalizeScore(input.latencyScore ?? 0.5, 'latencyScore'),
    metadata: sanitizeMetadata(input.metadata ?? {}),
  });
}

function normalizeScore(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${field} must be between 0 and 1`);
  }
  return value;
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 6) {
    return '[TRUNCATED]';
  }
  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    return value ?? null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 1024);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 64).map((entry) => sanitizeMetadata(entry, depth + 1));
  }
  if (typeof value === 'object') {
    const result = {};
    for (const [key, entry] of Object.entries(value).slice(0, 64)) {
      if (/(secret|token|password|api[_-]?key|authorization|cookie)/i.test(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = sanitizeMetadata(entry, depth + 1);
      }
    }
    return result;
  }
  return String(value).slice(0, 256);
}

export function classifyRequest(text) {
  const normalized = assertString(text, 'text', 100_000).toLocaleLowerCase('en-US');
  const intents = [
    ['code', /(code|bug|debug|typescript|javascript|python|php|laravel|react|برمج|كود|خطأ|تصحيح)/u],
    ['files', /(file|folder|pdf|document|spreadsheet|ملف|مجلد|مستند|اكسل|إكسل)/u],
    ['reasoning', /(analy[sz]e|architecture|plan|compare|investigate|حلل|خط[ةه]|قارن|افحص|معمار)/u],
    ['summarization', /(summari[sz]e|summary|لخص|تلخيص|ملخص)/u],
    ['vision', /(image|photo|screenshot|صورة|سكرين|لقطة)/u],
    ['tools', /(deploy|railway|github|database|terminal|docker|نشر|قاعدة|جيت|دوكر|سيرفر)/u],
  ];
  const capabilities = ['chat'];
  const matchedIntents = [];
  for (const [capability, pattern] of intents) {
    if (pattern.test(normalized)) {
      capabilities.push(capability);
      matchedIntents.push(capability);
    }
  }

  const lengthScore = Math.min(0.35, normalized.length / 20_000);
  const multiStepScore = /(?:\bthen\b|\bafter\b|\band\b.*\band\b|ثم|بعد ذلك|كمان|أيض[اً])/u.test(normalized) ? 0.2 : 0;
  const technicalScore = /(architecture|migration|security|performance|distributed|production|معمار|أمان|هجر[ةه]|أداء|إنتاج)/u.test(normalized) ? 0.25 : 0;
  const capabilityScore = Math.min(0.2, matchedIntents.length * 0.04);
  const complexity = Math.min(1, 0.15 + lengthScore + multiStepScore + technicalScore + capabilityScore);

  return Object.freeze({
    primaryIntent: matchedIntents[0] ?? 'chat',
    capabilities: Object.freeze([...new Set(capabilities)]),
    complexity,
    recommendedMinimumTier: complexity >= 0.75 ? 'premium' : complexity >= 0.45 ? 'free' : 'local',
  });
}

function providerAcceptsData(provider, dataClass) {
  return provider.allowedDataClasses.some((allowed) => DATA_RANK.get(allowed) >= DATA_RANK.get(dataClass));
}

function providerSupports(provider, requestedCapabilities) {
  return requestedCapabilities.every((capability) => provider.capabilities.includes(capability));
}

function tierIndex(tier, order) {
  const index = order.indexOf(tier);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function providerScore(provider, request, tierOrder) {
  const complexityFit = provider.tier === 'premium'
    ? request.classification.complexity
    : provider.tier === 'free'
      ? 1 - Math.abs(request.classification.complexity - 0.55)
      : 1 - request.classification.complexity;
  const costScore = provider.estimatedCostPerMillion === 0 ? 1 : provider.estimatedCostPerMillion == null ? 0.2 : 1 / (1 + provider.estimatedCostPerMillion);
  const tierPreference = 1 - tierIndex(provider.tier, tierOrder) / Math.max(1, tierOrder.length);
  return provider.qualityScore * 0.35 + provider.latencyScore * 0.2 + complexityFit * 0.25 + costScore * 0.1 + tierPreference * 0.1;
}

function normalizeRouteRequest(input) {
  const scope = normalizeScope(input.scope);
  const text = assertString(input.text, 'request.text', 100_000);
  const classification = input.classification ?? classifyRequest(text);
  const capabilities = normalizeCapabilities(input.capabilities ?? classification.capabilities, 'request.capabilities');
  const dataClass = input.dataClass ?? 'internal';
  if (!DATA_CLASS_SET.has(dataClass)) {
    throw new Error(`Unsupported data class: ${dataClass}`);
  }
  const estimatedInputTokens = input.estimatedInputTokens ?? Math.ceil(text.length / 4);
  if (!Number.isSafeInteger(estimatedInputTokens) || estimatedInputTokens < 1) {
    throw new Error('estimatedInputTokens must be a positive safe integer');
  }
  return Object.freeze({
    scope,
    text,
    classification,
    capabilities,
    dataClass,
    containsLocalFiles: Boolean(input.containsLocalFiles),
    estimatedInputTokens,
    sourceState: input.sourceState == null ? null : assertString(input.sourceState, 'request.sourceState', 512),
  });
}

export class ModelPolicyRouter {
  #providers = new Map();
  #healthEvents = [];

  constructor(providers = []) {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  register(providerInput) {
    const provider = normalizeProvider(providerInput);
    if (this.#providers.has(provider.id)) {
      throw new Error(`Provider already registered: ${provider.id}`);
    }
    this.#providers.set(provider.id, provider);
    return structuredClone(provider);
  }

  updateHealth(providerId, health, { reason = null, now = Date.now() } = {}) {
    if (!HEALTH_SET.has(health)) {
      throw new Error(`Unsupported provider health: ${health}`);
    }
    const current = this.#providers.get(providerId);
    if (!current) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    const updated = Object.freeze({ ...current, health });
    this.#providers.set(providerId, updated);
    this.#healthEvents.push(Object.freeze({ providerId, health, reason: sanitizeMetadata(reason), timestamp: now }));
    return structuredClone(updated);
  }

  route(input, policyInput = {}) {
    const request = normalizeRouteRequest(input);
    const policy = normalizePolicy(policyInput);
    const trace = {
      id: randomUUID(),
      scope: request.scope,
      classification: request.classification,
      requestedCapabilities: request.capabilities,
      dataClass: request.dataClass,
      considered: [],
      selected: null,
      fallbackProviderIds: [],
    };

    const candidates = [];
    for (const provider of this.#providers.values()) {
      const reasons = [];
      if (!provider.enabled) reasons.push('disabled');
      if (provider.health === 'down') reasons.push('down');
      if (provider.health === 'quota_exhausted') reasons.push('quota_exhausted');
      if (!policy.allowedTiers.includes(provider.tier)) reasons.push('tier_not_allowed');
      if (provider.tier === 'premium' && !policy.allowPremium) reasons.push('premium_requires_explicit_opt_in');
      if (!providerSupports(provider, request.capabilities)) reasons.push('missing_capability');
      if (!providerAcceptsData(provider, request.dataClass)) reasons.push('data_class_not_allowed');
      if (request.containsLocalFiles && provider.tier !== 'local' && !policy.allowCloudFileContent) reasons.push('local_file_content_blocked');
      if (request.estimatedInputTokens > provider.maxContextTokens) reasons.push('context_limit');
      if (provider.health === 'degraded' && !policy.allowDegraded) reasons.push('degraded_not_allowed');

      const eligible = reasons.length === 0;
      const score = eligible ? providerScore(provider, request, policy.tierOrder) : null;
      trace.considered.push(Object.freeze({ providerId: provider.id, eligible, reasons: Object.freeze(reasons.slice(0, MAX_TRACE_REASONS)), score }));
      if (eligible) {
        candidates.push({ provider, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score || tierIndex(a.provider.tier, policy.tierOrder) - tierIndex(b.provider.tier, policy.tierOrder) || a.provider.id.localeCompare(b.provider.id));
    if (candidates.length === 0) {
      const error = new Error('No provider satisfies the routing policy');
      error.code = 'NO_ELIGIBLE_PROVIDER';
      error.trace = trace;
      throw error;
    }

    const selected = candidates[0].provider;
    trace.selected = Object.freeze({ providerId: selected.id, tier: selected.tier, reason: 'highest_policy_score' });
    trace.fallbackProviderIds = Object.freeze(candidates.slice(1, 1 + policy.maxFallbacks).map(({ provider }) => provider.id));
    return Object.freeze({
      provider: structuredClone(selected),
      fallbacks: trace.fallbackProviderIds.map((id) => structuredClone(this.#providers.get(id))),
      trace: Object.freeze(trace),
    });
  }

  listProviders() {
    return [...this.#providers.values()].map((provider) => structuredClone(provider));
  }

  getHealthEvents() {
    return this.#healthEvents.map((event) => structuredClone(event));
  }
}

function normalizePolicy(input) {
  const allowedTiers = input.allowedTiers ?? DEFAULT_TIER_ORDER;
  if (!Array.isArray(allowedTiers) || allowedTiers.length === 0 || allowedTiers.some((tier) => !TIER_SET.has(tier))) {
    throw new Error('allowedTiers contains an unsupported tier');
  }
  const tierOrder = input.tierOrder ?? DEFAULT_TIER_ORDER;
  if (!Array.isArray(tierOrder) || tierOrder.length !== PROVIDER_TIERS.length || new Set(tierOrder).size !== PROVIDER_TIERS.length || tierOrder.some((tier) => !TIER_SET.has(tier))) {
    throw new Error('tierOrder must include each tier exactly once');
  }
  const maxFallbacks = input.maxFallbacks ?? 2;
  if (!Number.isSafeInteger(maxFallbacks) || maxFallbacks < 0 || maxFallbacks > 5) {
    throw new Error('maxFallbacks must be between 0 and 5');
  }
  return Object.freeze({
    allowedTiers: Object.freeze([...new Set(allowedTiers)]),
    tierOrder: Object.freeze([...tierOrder]),
    allowPremium: Boolean(input.allowPremium),
    allowCloudFileContent: Boolean(input.allowCloudFileContent),
    allowDegraded: Boolean(input.allowDegraded),
    maxFallbacks,
  });
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function cacheKey(scope, request) {
  return createHash('sha256')
    .update(stableJson({
      scope,
      text: request.text,
      capabilities: request.capabilities,
      dataClass: request.dataClass,
      sourceState: request.sourceState,
    }))
    .digest('hex');
}

export class ScopedResultCache {
  #entries = new Map();

  set(input, value, { ttlMs = 15 * 60 * 1000, now = Date.now() } = {}) {
    const request = normalizeRouteRequest(input);
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 7 * 24 * 60 * 60 * 1000) {
      throw new Error('ttlMs is outside the supported range');
    }
    const key = cacheKey(request.scope, request);
    this.#entries.set(key, Object.freeze({
      scope: request.scope,
      sourceState: request.sourceState,
      value: sanitizeMetadata(value),
      createdAt: now,
      expiresAt: now + ttlMs,
    }));
    return key;
  }

  get(input, { now = Date.now() } = {}) {
    const request = normalizeRouteRequest(input);
    const key = cacheKey(request.scope, request);
    const entry = this.#entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.#entries.delete(key);
      return null;
    }
    if (entry.sourceState !== request.sourceState) return null;
    return structuredClone(entry.value);
  }

  clearScope(scopeInput) {
    const scope = normalizeScope(scopeInput);
    let removed = 0;
    for (const [key, entry] of this.#entries) {
      if (scopeKey(entry.scope) === scopeKey(scope)) {
        this.#entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}
