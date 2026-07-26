import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EvaluationSandbox,
  createCandidate,
  createEvaluationDataset,
} from '../src/index.mjs';
import { AgentMemoryLedger } from '../../agent-memory-ledger/src/index.mjs';

const scope = Object.freeze({ ownerId: 'alice', projectId: 'alpha' });

function dataset() {
  return createEvaluationDataset({
    scope,
    name: 'Core agent benchmark',
    version: '1.0.0',
    createdAt: 1000,
    cases: [
      { id: 'answer', input: { prompt: 'answer' }, expected: { fact: 'A' }, tags: ['quality'] },
      { id: 'safety', input: { prompt: 'safe' }, expected: { refusal: true }, tags: ['safety'], severity: 'critical' },
    ],
  });
}

function candidate(version = '2.0.0') {
  return createCandidate({
    scope,
    kind: 'prompt',
    name: 'General agent',
    version,
    baseVersion: '1.0.0',
    createdBy: 'optimizer',
    createdAt: 2000,
    content: { instructions: 'Be accurate and safe' },
  });
}

test('datasets and candidates are reproducible and content-addressed', () => {
  const firstDataset = dataset();
  const secondDataset = createEvaluationDataset({
    scope,
    name: 'Core agent benchmark',
    version: '1.0.0',
    createdAt: 1000,
    cases: [
      { id: 'answer', input: { prompt: 'answer' }, expected: { fact: 'A' }, tags: ['quality'] },
      { id: 'safety', input: { prompt: 'safe' }, expected: { refusal: true }, tags: ['safety'], severity: 'critical' },
    ],
  });
  const firstCandidate = candidate();
  const secondCandidate = candidate();
  assert.equal(firstDataset.contentHash, secondDataset.contentHash);
  assert.equal(firstCandidate.contentHash, secondCandidate.contentHash);
  assert.notEqual(firstCandidate.id, secondCandidate.id);
});

test('passing evaluation still requires explicit human approval', async () => {
  const sandbox = new EvaluationSandbox();
  const report = await sandbox.evaluate({
    dataset: dataset(),
    candidate: candidate(),
    runner: async () => ({ outcome: 'pass', quality: 1, safety: 1, latencyMs: 100, cost: 0.01 }),
    thresholds: { minimumQuality: 0.9, minimumSafety: 1, maximumLatencyMs: 1000, maximumCost: 0.1 },
    now: 3000,
  });
  assert.equal(report.eligibleForApproval, true);
  assert.throws(() => sandbox.createPromotionPlan(report.id, { scope }), /approval threshold/);
  sandbox.approve(report.id, { scope, approverId: 'human-reviewer', now: 4000 });
  const plan = sandbox.createPromotionPlan(report.id, { scope, target: 'staging', now: 5000 });
  assert.equal(plan.status, 'ready_for_manual_promotion');
  assert.equal(plan.target, 'staging');
});

test('safety failure blocks approval even when quality is perfect', async () => {
  const sandbox = new EvaluationSandbox();
  const report = await sandbox.evaluate({
    dataset: dataset(),
    candidate: candidate(),
    runner: async ({ testCase }) => testCase.id === 'safety'
      ? { outcome: 'fail', quality: 1, safety: 0, violations: ['unsafe_tool_permission'] }
      : { outcome: 'pass', quality: 1, safety: 1 },
    now: 3000,
  });
  assert.equal(report.eligibleForApproval, false);
  assert.ok(report.blockers.includes('safety_below_threshold'));
  assert.ok(report.blockers.includes('safety_violations_present'));
  assert.throws(() => sandbox.approve(report.id, { scope, approverId: 'reviewer' }), /cannot be approved/);
});

test('latency and cost thresholds block promotion', async () => {
  const sandbox = new EvaluationSandbox();
  const report = await sandbox.evaluate({
    dataset: dataset(),
    candidate: candidate(),
    runner: async () => ({ outcome: 'pass', quality: 1, safety: 1, latencyMs: 5000, cost: 2 }),
    thresholds: { maximumLatencyMs: 1000, maximumCost: 0.5 },
    now: 3000,
  });
  assert.ok(report.blockers.includes('latency_above_threshold'));
  assert.ok(report.blockers.includes('cost_above_threshold'));
});

test('candidate regression against baseline blocks promotion', async () => {
  const sandbox = new EvaluationSandbox();
  const baseline = await sandbox.evaluate({
    dataset: dataset(),
    candidate: candidate('1.5.0'),
    runner: async () => ({ outcome: 'pass', quality: 1, safety: 1, latencyMs: 100, cost: 0 }),
    now: 3000,
  });
  const regressed = await sandbox.evaluate({
    dataset: dataset(),
    candidate: candidate('2.0.0'),
    baselineReport: baseline,
    runner: async () => ({ outcome: 'pass', quality: 0.7, safety: 1, latencyMs: 100, cost: 0 }),
    thresholds: { minimumQuality: 0.6, maximumRegression: 0.01 },
    now: 4000,
  });
  assert.ok(regressed.regression > 0.01);
  assert.ok(regressed.blockers.includes('regression_above_threshold'));
});

test('runner errors become reproducible failed results instead of crashing evaluation', async () => {
  const sandbox = new EvaluationSandbox();
  const report = await sandbox.evaluate({
    dataset: dataset(),
    candidate: candidate(),
    runner: async () => { throw new Error('provider unavailable'); },
    now: 3000,
  });
  assert.equal(report.summary.failedCases, 2);
  assert.equal(report.results[0].outcome, 'error');
  assert.ok(report.results[0].violations.includes('runner_error'));
});

test('scope isolation prevents reading or approving another project report', async () => {
  const sandbox = new EvaluationSandbox();
  const report = await sandbox.evaluate({
    dataset: dataset(),
    candidate: candidate(),
    runner: async () => ({ outcome: 'pass', quality: 1, safety: 1 }),
    now: 3000,
  });
  const wrongScope = { ownerId: 'bob', projectId: 'alpha' };
  assert.equal(sandbox.getReport(report.id, wrongScope), null);
  assert.throws(() => sandbox.approve(report.id, { scope: wrongScope, approverId: 'bob' }), /not found/);
});

test('secrets are removed from candidates and evaluation outputs', async () => {
  const sandbox = new EvaluationSandbox();
  const secretCandidate = createCandidate({
    scope,
    kind: 'prompt',
    name: 'Secret test',
    version: '1',
    baseVersion: '0',
    createdBy: 'tester',
    content: { apiKey: 'secret', text: 'Use sk-ABCDEFGHIJKLMNOPQRST' },
  });
  assert.equal(secretCandidate.content.apiKey, '[REDACTED]');
  assert.doesNotMatch(secretCandidate.content.text, /sk-/);
  const report = await sandbox.evaluate({
    dataset: dataset(),
    candidate: secretCandidate,
    runner: async () => ({ outcome: 'pass', quality: 1, safety: 1, output: { token: 'secret', text: 'Bearer abc.def.ghi' } }),
  });
  assert.equal(report.results[0].output.token, '[REDACTED]');
  assert.doesNotMatch(report.results[0].output.text, /Bearer/);
});

test('two distinct human approvals can be required', async () => {
  const sandbox = new EvaluationSandbox();
  const report = await sandbox.evaluate({
    dataset: dataset(),
    candidate: candidate(),
    runner: async () => ({ outcome: 'pass', quality: 1, safety: 1 }),
  });
  sandbox.approve(report.id, { scope, approverId: 'reviewer-a' });
  sandbox.approve(report.id, { scope, approverId: 'reviewer-a' });
  assert.throws(() => sandbox.createPromotionPlan(report.id, { scope, requiredApprovals: 2 }), /threshold/);
  sandbox.approve(report.id, { scope, approverId: 'reviewer-b' });
  assert.equal(sandbox.createPromotionPlan(report.id, { scope, requiredApprovals: 2 }).approvalIds.length, 3);
});

test('evaluation reports append offline run ledger records without secrets', async () => {
  const sandbox = new EvaluationSandbox();
  const ledger = new AgentMemoryLedger();
  const report = await sandbox.evaluate({
    dataset: dataset(),
    candidate: candidate(),
    runner: async () => ({ outcome: 'pass', quality: 1, safety: 1, output: { token: 'secret' } }),
    now: 3000,
  });
  const run = sandbox.appendOfflineReportToLedger(report.id, { scope, ledger, now: 4000 });

  assert.equal(run.scope.userId, 'alice');
  assert.equal(run.scope.projectId, 'alpha');
  assert.equal(run.intent, 'offline_evaluation_report');
  assert.equal(run.provider, 'offline');
  assert.equal(run.metadata.approvalState, 'eligible_for_staging');
  assert.equal(ledger.listRuns({ scope: { userId: 'alice', projectId: 'alpha' } }).length, 1);
  assert.doesNotMatch(JSON.stringify(run), /secret/);
});

test('manual approval states are scoped and never promote production automatically', async () => {
  const sandbox = new EvaluationSandbox();
  const report = await sandbox.evaluate({
    dataset: dataset(),
    candidate: candidate(),
    runner: async () => ({ outcome: 'pass', quality: 1, safety: 1 }),
  });
  const approved = sandbox.setApprovalState(report.id, {
    scope,
    state: 'approved_for_staging',
    reviewerId: 'reviewer-a',
    now: 5000,
  });

  assert.equal(approved.state, 'approved_for_staging');
  assert.equal(sandbox.getApprovalState(report.id, scope).state, 'approved_for_staging');
  assert.throws(
    () => sandbox.setApprovalState(report.id, { scope: { ownerId: 'bob', projectId: 'alpha' }, state: 'rejected', reviewerId: 'bob' }),
    /not found/,
  );
  sandbox.approve(report.id, { scope, approverId: 'reviewer-a' });
  assert.equal(sandbox.createPromotionPlan(report.id, { scope, target: 'staging' }).target, 'staging');
  assert.equal(sandbox.createPromotionPlan(report.id, { scope, target: 'staging' }).status, 'ready_for_manual_promotion');
});
