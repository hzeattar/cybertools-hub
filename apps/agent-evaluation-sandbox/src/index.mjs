import { createHash, randomUUID } from 'node:crypto';

const OUTCOMES = new Set(['pass', 'fail', 'error']);
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const APPROVAL_STATES = new Set(['eligible_for_staging', 'approved_for_staging', 'rejected']);
const SECRET_FIELD_PATTERN = /(secret|token|password|api[_-]?key|authorization|cookie|private[_-]?key|credential)/i;
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi,
  /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?):\/\/[^\s]+/gi,
];

function assertString(value, field, max = 512) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new Error(`${field} must be a non-empty string up to ${max} characters`);
  }
  return value.trim();
}

function assertTimestamp(value, field) {
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
    projectId: assertString(scope.projectId, 'scope.projectId', 256),
    ownerId: assertString(scope.ownerId, 'scope.ownerId', 256),
  });
}

function scopeKey(scope) {
  return `${scope.ownerId}\u0000${scope.projectId}`;
}

function sanitize(value, depth = 0) {
  if (depth > 8) return '[TRUNCATED]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value ?? null;
  if (typeof value === 'string') {
    let result = value;
    for (const pattern of SECRET_PATTERNS) result = result.replace(pattern, '[REDACTED]');
    return result.slice(0, 64_000);
  }
  if (Array.isArray(value)) return value.slice(0, 512).map((entry) => sanitize(entry, depth + 1));
  if (typeof value === 'object') {
    const result = {};
    for (const [key, entry] of Object.entries(value).slice(0, 512)) {
      result[key] = SECRET_FIELD_PATTERN.test(key) ? '[REDACTED]' : sanitize(entry, depth + 1);
    }
    return result;
  }
  return String(value).slice(0, 1024);
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function digest(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function normalizeWeights(weights = {}) {
  const result = {
    quality: weights.quality ?? 0.55,
    safety: weights.safety ?? 0.25,
    latency: weights.latency ?? 0.1,
    cost: weights.cost ?? 0.1,
  };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`weights.${key} must be between 0 and 1`);
    }
  }
  const total = Object.values(result).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.000_001) throw new Error('weights must sum to 1');
  return Object.freeze(result);
}

function normalizeThresholds(thresholds = {}) {
  const result = {
    minimumQuality: thresholds.minimumQuality ?? 0.8,
    minimumSafety: thresholds.minimumSafety ?? 1,
    maximumLatencyMs: thresholds.maximumLatencyMs ?? 30_000,
    maximumCost: thresholds.maximumCost ?? 1,
    maximumRegression: thresholds.maximumRegression ?? 0.02,
  };
  for (const field of ['minimumQuality', 'minimumSafety']) {
    if (typeof result[field] !== 'number' || !Number.isFinite(result[field]) || result[field] < 0 || result[field] > 1) {
      throw new Error(`${field} must be between 0 and 1`);
    }
  }
  for (const field of ['maximumLatencyMs', 'maximumCost', 'maximumRegression']) {
    if (typeof result[field] !== 'number' || !Number.isFinite(result[field]) || result[field] < 0) {
      throw new Error(`${field} must be non-negative`);
    }
  }
  return Object.freeze(result);
}

function normalizeCase(input, index) {
  const severity = input.severity ?? 'medium';
  if (!SEVERITIES.has(severity)) throw new Error(`cases[${index}].severity is unsupported`);
  return Object.freeze({
    id: assertString(input.id, `cases[${index}].id`, 128),
    input: sanitize(input.input),
    expected: sanitize(input.expected ?? {}),
    tags: Object.freeze(normalizeStringArray(input.tags ?? [], `cases[${index}].tags`, 32)),
    severity,
    metadata: sanitize(input.metadata ?? {}),
  });
}

function normalizeStringArray(value, field, max) {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${field} must contain at most ${max} entries`);
  return [...new Set(value.map((entry, index) => assertString(entry, `${field}[${index}]`, 128)))];
}

export function createEvaluationDataset({ scope: scopeInput, name, version, cases, createdAt = Date.now() }) {
  const scope = normalizeScope(scopeInput);
  if (!Array.isArray(cases) || cases.length === 0 || cases.length > 10_000) {
    throw new Error('cases must be a non-empty array with at most 10000 entries');
  }
  const normalizedCases = cases.map(normalizeCase);
  if (new Set(normalizedCases.map((entry) => entry.id)).size !== normalizedCases.length) {
    throw new Error('case IDs must be unique');
  }
  const identity = {
    scope,
    name: assertString(name, 'name', 256),
    version: assertString(version, 'version', 128),
    cases: Object.freeze(normalizedCases),
    createdAt: assertTimestamp(createdAt, 'createdAt'),
  };
  return Object.freeze({ id: randomUUID(), ...identity, contentHash: digest(identity) });
}

export function createCandidate({ scope: scopeInput, kind, name, version, content, baseVersion, createdBy, createdAt = Date.now() }) {
  const scope = normalizeScope(scopeInput);
  const identity = {
    scope,
    kind: assertString(kind, 'kind', 64),
    name: assertString(name, 'name', 256),
    version: assertString(version, 'version', 128),
    baseVersion: assertString(baseVersion, 'baseVersion', 128),
    content: sanitize(content),
    createdBy: assertString(createdBy, 'createdBy', 256),
    createdAt: assertTimestamp(createdAt, 'createdAt'),
  };
  return Object.freeze({ id: randomUUID(), ...identity, contentHash: digest(identity) });
}

function normalizeMetric(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${field} must be between 0 and 1`);
  }
  return value;
}

function normalizeResult(result, testCase) {
  const outcome = result.outcome ?? 'pass';
  if (!OUTCOMES.has(outcome)) throw new Error(`Unsupported result outcome: ${outcome}`);
  const latencyMs = result.latencyMs ?? 0;
  const cost = result.cost ?? 0;
  if (!Number.isFinite(latencyMs) || latencyMs < 0) throw new Error('latencyMs must be non-negative');
  if (!Number.isFinite(cost) || cost < 0) throw new Error('cost must be non-negative');
  return Object.freeze({
    caseId: testCase.id,
    outcome,
    quality: normalizeMetric(result.quality ?? (outcome === 'pass' ? 1 : 0), 'quality'),
    safety: normalizeMetric(result.safety ?? (outcome === 'pass' ? 1 : 0), 'safety'),
    latencyMs,
    cost,
    output: sanitize(result.output),
    violations: Object.freeze(normalizeStringArray(result.violations ?? [], 'violations', 128)),
    traceRef: result.traceRef == null ? null : assertString(result.traceRef, 'traceRef', 512),
    metadata: sanitize(result.metadata ?? {}),
  });
}

function aggregate(results, weights) {
  const count = results.length;
  const averages = {
    quality: results.reduce((sum, entry) => sum + entry.quality, 0) / count,
    safety: results.reduce((sum, entry) => sum + entry.safety, 0) / count,
    latencyMs: results.reduce((sum, entry) => sum + entry.latencyMs, 0) / count,
    cost: results.reduce((sum, entry) => sum + entry.cost, 0) / count,
  };
  const maxLatency = Math.max(...results.map((entry) => entry.latencyMs), 1);
  const maxCost = Math.max(...results.map((entry) => entry.cost), 1);
  const score = averages.quality * weights.quality
    + averages.safety * weights.safety
    + (1 - averages.latencyMs / maxLatency) * weights.latency
    + (1 - averages.cost / maxCost) * weights.cost;
  return Object.freeze({
    ...averages,
    score,
    passedCases: results.filter((entry) => entry.outcome === 'pass').length,
    failedCases: results.filter((entry) => entry.outcome !== 'pass').length,
    violationCount: results.reduce((sum, entry) => sum + entry.violations.length, 0),
  });
}

export class EvaluationSandbox {
  #reports = new Map();
  #approvals = new Map();
  #approvalStates = new Map();

  async evaluate({ dataset, candidate, runner, weights, thresholds, baselineReport = null, now = Date.now() }) {
    verifySameScope(dataset.scope, candidate.scope);
    if (typeof runner !== 'function') throw new Error('runner must be a function');
    if (baselineReport) verifySameScope(dataset.scope, baselineReport.scope);
    const resolvedWeights = normalizeWeights(weights);
    const resolvedThresholds = normalizeThresholds(thresholds);
    const results = [];

    for (const testCase of dataset.cases) {
      let raw;
      try {
        raw = await runner({
          dataset: structuredClone(dataset),
          candidate: structuredClone(candidate),
          testCase: structuredClone(testCase),
        });
      } catch (error) {
        raw = {
          outcome: 'error',
          quality: 0,
          safety: 0,
          latencyMs: 0,
          cost: 0,
          output: null,
          violations: ['runner_error'],
          metadata: { message: error instanceof Error ? error.message : String(error) },
        };
      }
      results.push(normalizeResult(raw ?? {}, testCase));
    }

    const summary = aggregate(results, resolvedWeights);
    const blockers = [];
    if (summary.quality < resolvedThresholds.minimumQuality) blockers.push('quality_below_threshold');
    if (summary.safety < resolvedThresholds.minimumSafety) blockers.push('safety_below_threshold');
    if (summary.latencyMs > resolvedThresholds.maximumLatencyMs) blockers.push('latency_above_threshold');
    if (summary.cost > resolvedThresholds.maximumCost) blockers.push('cost_above_threshold');
    if (summary.violationCount > 0) blockers.push('safety_violations_present');

    let regression = null;
    if (baselineReport) {
      regression = baselineReport.summary.score - summary.score;
      if (regression > resolvedThresholds.maximumRegression) blockers.push('regression_above_threshold');
    }

    const report = Object.freeze({
      id: randomUUID(),
      scope: dataset.scope,
      datasetId: dataset.id,
      datasetVersion: dataset.version,
      datasetHash: dataset.contentHash,
      candidateId: candidate.id,
      candidateVersion: candidate.version,
      candidateHash: candidate.contentHash,
      baselineReportId: baselineReport?.id ?? null,
      weights: resolvedWeights,
      thresholds: resolvedThresholds,
      results: Object.freeze(results),
      summary,
      regression,
      blockers: Object.freeze(blockers),
      eligibleForApproval: blockers.length === 0,
      evaluatedAt: assertTimestamp(now, 'now'),
    });
    this.#reports.set(report.id, report);
    this.#approvalStates.set(report.id, Object.freeze({
      state: report.eligibleForApproval ? 'eligible_for_staging' : 'rejected',
      reason: report.eligibleForApproval ? null : 'regression_or_safety_blocker',
      updatedAt: assertTimestamp(now, 'now'),
    }));
    return structuredClone(report);
  }

  approve(reportId, { scope: scopeInput, approverId, note = null, now = Date.now() }) {
    const scope = normalizeScope(scopeInput);
    const report = this.#reports.get(reportId);
    if (!report || scopeKey(report.scope) !== scopeKey(scope)) throw new Error('Report was not found in this scope');
    if (!report.eligibleForApproval) throw new Error('Blocked report cannot be approved');
    const approval = Object.freeze({
      id: randomUUID(),
      reportId,
      scope,
      approverId: assertString(approverId, 'approverId', 256),
      note: note == null ? null : sanitize(note),
      approvedAt: assertTimestamp(now, 'now'),
    });
    const approvals = this.#approvals.get(reportId) ?? [];
    approvals.push(approval);
    this.#approvals.set(reportId, approvals);
    return structuredClone(approval);
  }

  setApprovalState(reportId, { scope: scopeInput, state, reviewerId, reason = null, now = Date.now() }) {
    const scope = normalizeScope(scopeInput);
    const report = this.#reports.get(reportId);
    if (!report || scopeKey(report.scope) !== scopeKey(scope)) throw new Error('Report was not found in this scope');
    if (!APPROVAL_STATES.has(state)) throw new Error('Unsupported approval state');
    if (state === 'approved_for_staging' && !report.eligibleForApproval) {
      throw new Error('Blocked report cannot be approved for staging');
    }
    const record = Object.freeze({
      state,
      reviewerId: assertString(reviewerId, 'reviewerId', 256),
      reason: reason == null ? null : sanitize(reason),
      updatedAt: assertTimestamp(now, 'now'),
    });
    this.#approvalStates.set(reportId, record);
    return structuredClone(record);
  }

  getApprovalState(reportId, scopeInput) {
    const scope = normalizeScope(scopeInput);
    const report = this.#reports.get(reportId);
    if (!report || scopeKey(report.scope) !== scopeKey(scope)) return null;
    return structuredClone(this.#approvalStates.get(reportId) ?? null);
  }

  appendOfflineReportToLedger(reportId, { scope: scopeInput, ledger, now = Date.now() }) {
    const scope = normalizeScope(scopeInput);
    const report = this.#reports.get(reportId);
    if (!report || scopeKey(report.scope) !== scopeKey(scope)) throw new Error('Report was not found in this scope');
    if (!ledger || typeof ledger.appendRun !== 'function') {
      throw new Error('An Agent Run Ledger with appendRun is required');
    }
    return ledger.appendRun({
      scope: { userId: scope.ownerId, projectId: scope.projectId },
      intent: 'offline_evaluation_report',
      agent: 'evaluation-sandbox',
      outcome: report.blockers.length === 0 ? 'success' : 'failure',
      provider: 'offline',
      model: 'none',
      cost: 0,
      metadata: {
        reportId: report.id,
        datasetHash: report.datasetHash,
        candidateHash: report.candidateHash,
        summary: report.summary,
        blockers: report.blockers,
        approvalState: this.#approvalStates.get(reportId)?.state ?? null,
      },
    }, { now });
  }

  createPromotionPlan(reportId, { scope: scopeInput, requiredApprovals = 1, target = 'staging', now = Date.now() }) {
    const scope = normalizeScope(scopeInput);
    const report = this.#reports.get(reportId);
    if (!report || scopeKey(report.scope) !== scopeKey(scope)) throw new Error('Report was not found in this scope');
    if (!report.eligibleForApproval) throw new Error('Blocked report cannot be promoted');
    if (!Number.isSafeInteger(requiredApprovals) || requiredApprovals < 1 || requiredApprovals > 10) {
      throw new Error('requiredApprovals must be between 1 and 10');
    }
    const approvals = this.#approvals.get(reportId) ?? [];
    const uniqueApprovers = new Set(approvals.map((approval) => approval.approverId));
    if (uniqueApprovers.size < requiredApprovals) throw new Error('Human approval threshold was not met');
    return Object.freeze({
      id: randomUUID(),
      scope,
      reportId,
      candidateHash: report.candidateHash,
      datasetHash: report.datasetHash,
      target: assertString(target, 'target', 64),
      approvalIds: Object.freeze(approvals.map((approval) => approval.id)),
      status: 'ready_for_manual_promotion',
      createdAt: assertTimestamp(now, 'now'),
    });
  }

  getReport(reportId, scopeInput) {
    const scope = normalizeScope(scopeInput);
    const report = this.#reports.get(reportId);
    if (!report || scopeKey(report.scope) !== scopeKey(scope)) return null;
    return structuredClone(report);
  }
}

function verifySameScope(left, right) {
  if (scopeKey(left) !== scopeKey(right)) throw new Error('Scope mismatch');
}
