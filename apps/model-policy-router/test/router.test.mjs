import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ModelPolicyRouter,
  ScopedResultCache,
  classifyRequest,
} from '../src/index.mjs';

const scope = Object.freeze({ userId: 'alice', projectId: 'alpha' });

function providers() {
  return [
    {
      id: 'local-small',
      tier: 'local',
      capabilities: ['chat', 'code', 'summarization'],
      allowedDataClasses: ['public', 'internal', 'confidential', 'restricted'],
      maxContextTokens: 16_000,
      qualityScore: 0.55,
      latencyScore: 0.95,
    },
    {
      id: 'free-general',
      tier: 'free',
      capabilities: ['chat', 'reasoning', 'code', 'files', 'tools', 'summarization'],
      allowedDataClasses: ['public', 'internal'],
      maxContextTokens: 64_000,
      qualityScore: 0.72,
      latencyScore: 0.6,
    },
    {
      id: 'premium-reasoner',
      tier: 'premium',
      capabilities: ['chat', 'reasoning', 'code', 'files', 'vision', 'tools', 'summarization'],
      allowedDataClasses: ['public', 'internal', 'confidential'],
      maxContextTokens: 128_000,
      estimatedCostPerMillion: 10,
      qualityScore: 0.95,
      latencyScore: 0.45,
    },
  ];
}

test('local classification identifies technical capabilities and complexity', () => {
  const result = classifyRequest('حلل معمارية مشروع Laravel ثم افحص Docker deployment على Railway');
  assert.ok(result.capabilities.includes('code'));
  assert.ok(result.capabilities.includes('reasoning'));
  assert.ok(result.capabilities.includes('tools'));
  assert.ok(result.complexity > 0.5);
});

test('simple requests prefer an eligible local provider', () => {
  const router = new ModelPolicyRouter(providers());
  const result = router.route({ scope, text: 'Summarize this short paragraph', capabilities: ['chat', 'summarization'], dataClass: 'internal' });
  assert.equal(result.provider.id, 'local-small');
  assert.equal(result.trace.selected.tier, 'local');
});

test('premium providers are never selected without explicit opt-in', () => {
  const router = new ModelPolicyRouter(providers());
  const input = { scope, text: 'Perform a complex architecture analysis', capabilities: ['chat', 'reasoning'], dataClass: 'internal' };
  const withoutPremium = router.route(input);
  assert.equal(withoutPremium.provider.id, 'free-general');
  assert.ok(withoutPremium.trace.considered.find((item) => item.providerId === 'premium-reasoner').reasons.includes('premium_requires_explicit_opt_in'));
  const withPremium = router.route(input, { allowPremium: true, allowedTiers: ['premium'] });
  assert.equal(withPremium.provider.id, 'premium-reasoner');
});

test('local file content cannot silently leave the device', () => {
  const router = new ModelPolicyRouter(providers());
  const input = {
    scope,
    text: 'Analyze local project files',
    capabilities: ['chat', 'reasoning', 'files'],
    dataClass: 'internal',
    containsLocalFiles: true,
  };
  assert.throws(() => router.route(input, { allowPremium: true }), (error) => {
    assert.equal(error.code, 'NO_ELIGIBLE_PROVIDER');
    assert.ok(error.trace.considered.every((item) => !item.eligible));
    return true;
  });
  const allowed = router.route(input, { allowPremium: true, allowCloudFileContent: true, allowedTiers: ['premium'] });
  assert.equal(allowed.provider.id, 'premium-reasoner');
});

test('restricted data remains local even when premium is enabled', () => {
  const router = new ModelPolicyRouter(providers());
  const result = router.route({
    scope,
    text: 'Review confidential configuration',
    capabilities: ['chat', 'code'],
    dataClass: 'restricted',
  }, { allowPremium: true });
  assert.equal(result.provider.id, 'local-small');
});

test('provider health changes routing and produces bounded fallbacks', () => {
  const router = new ModelPolicyRouter(providers());
  router.updateHealth('local-small', 'down', { reason: 'offline', now: 1000 });
  const result = router.route({ scope, text: 'Summarize notes', capabilities: ['chat', 'summarization'], dataClass: 'internal' }, { maxFallbacks: 1 });
  assert.equal(result.provider.id, 'free-general');
  assert.ok(result.trace.considered.find((item) => item.providerId === 'local-small').reasons.includes('down'));
  assert.equal(router.getHealthEvents().length, 1);
});

test('unknown or disabled providers can never be selected', () => {
  const router = new ModelPolicyRouter([
    { id: 'disabled', tier: 'local', enabled: false, capabilities: ['chat'], allowedDataClasses: ['restricted'] },
  ]);
  assert.throws(() => router.route({ scope, text: 'hello', capabilities: ['chat'], dataClass: 'public' }), /No provider/);
  assert.throws(() => router.updateHealth('unknown', 'healthy'), /Unknown provider/);
});

test('result cache is isolated by scope, source state, and expiry', () => {
  const cache = new ScopedResultCache();
  const request = { scope, text: 'Explain current project', capabilities: ['chat'], dataClass: 'internal', sourceState: 'commit-a' };
  cache.set(request, { answer: 'A', apiKey: 'must-redact' }, { now: 1000, ttlMs: 1000 });
  assert.deepEqual(cache.get(request, { now: 1500 }), { answer: 'A', apiKey: '[REDACTED]' });
  assert.equal(cache.get({ ...request, scope: { userId: 'bob', projectId: 'alpha' } }, { now: 1500 }), null);
  assert.equal(cache.get({ ...request, sourceState: 'commit-b' }, { now: 1500 }), null);
  assert.equal(cache.get(request, { now: 2000 }), null);
});

test('cache clearing affects only the requested scope', () => {
  const cache = new ScopedResultCache();
  const first = { scope, text: 'one', capabilities: ['chat'], dataClass: 'internal' };
  const second = { scope: { userId: 'bob', projectId: 'alpha' }, text: 'two', capabilities: ['chat'], dataClass: 'internal' };
  cache.set(first, { answer: 1 }, { now: 1000 });
  cache.set(second, { answer: 2 }, { now: 1000 });
  assert.equal(cache.clearScope(scope), 1);
  assert.equal(cache.get(first, { now: 1100 }), null);
  assert.deepEqual(cache.get(second, { now: 1100 }), { answer: 2 });
});
