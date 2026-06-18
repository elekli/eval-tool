import { describe, test, expect } from 'vitest';
import { computeSummary } from './summary';
import type { TestCase, Result } from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCase(id: string, vars: Record<string, string> = {}): TestCase {
  return { id, datasetId: 'ds1', vars };
}

function makeResult(
  overrides: Partial<Result> & { testCaseId: string },
): Result {
  return {
    id: overrides.id ?? `r-${Math.random()}`,
    runId: 'run1',
    testCaseId: overrides.testCaseId,
    repeatIndex: overrides.repeatIndex ?? 0,
    status: overrides.status ?? 'ok',
    outputText: overrides.outputText,
    toolCalls: overrides.toolCalls,
    judgeVerdict: overrides.judgeVerdict,
    usage: overrides.usage,
    error: overrides.error,
    createdAt: 1,
  };
}

// ── 6.1.1: behaviour rollup – scoreMean/std + totalCostUsd ───────────────────

describe('computeSummary – behavior type', () => {
  test('computes scoreMean, scoreStd, distinctOutputCount and totalCostUsd', () => {
    const cases = [makeCase('c1', { article: 'hello' })];
    const results: Result[] = [
      makeResult({
        id: 'r1', testCaseId: 'c1', repeatIndex: 0,
        outputText: 'A',
        judgeVerdict: { score: 3, reasoning: '' },
        usage: { promptTokens: 10, completionTokens: 5, costUsd: 0.001 },
      }),
      makeResult({
        id: 'r2', testCaseId: 'c1', repeatIndex: 1,
        outputText: 'B',
        judgeVerdict: { score: 5, reasoning: '' },
        usage: { promptTokens: 10, completionTokens: 5, costUsd: 0.002 },
      }),
    ];

    const summary = computeSummary('behavior', cases, results);

    expect(summary.type).toBe('behavior');
    expect(summary.totalCostUsd).toBeCloseTo(0.003);
    expect(summary.errorCount).toBe(0);

    const c = summary.cases[0];
    expect(c?.testCaseId).toBe('c1');
    expect(c?.label).toBe('hello');          // first non-empty var value
    expect(c?.repeatCount).toBe(2);
    expect(c?.errorCount).toBe(0);
    expect(c?.scoreMean).toBeCloseTo(4);     // (3+5)/2
    expect(c?.scoreStd).toBeCloseTo(1);      // pop std of [3,5]
    expect(c?.distinctOutputCount).toBe(2);  // 'A' and 'B'
    expect(c?.isOutlier).toBe(false);        // std=1.0 is NOT > 1.0
  });

  test('omits score fields when judge is absent', () => {
    const cases = [makeCase('c1')];
    const results: Result[] = [
      makeResult({ id: 'r1', testCaseId: 'c1', outputText: 'X' }),
    ];

    const summary = computeSummary('behavior', cases, results);
    const c = summary.cases[0]!;

    expect(c.scoreMean).toBeUndefined();
    expect(c.scoreStd).toBeUndefined();
    // distinctOutputCount is still computed (doesn't depend on judge)
    expect(c.distinctOutputCount).toBe(1);
  });

  test('label falls back to testCaseId when vars is empty', () => {
    const cases = [makeCase('c1', {})];
    const results: Result[] = [
      makeResult({ id: 'r1', testCaseId: 'c1', outputText: 'X' }),
    ];

    const summary = computeSummary('behavior', cases, results);
    expect(summary.cases[0]?.label).toBe('c1');
  });

  test('high-variance case is flagged as outlier and id appears in outliers', () => {
    const cases = [makeCase('c1', { article: 'hi' })];
    const results: Result[] = [
      makeResult({ id: 'r1', testCaseId: 'c1', outputText: 'A', judgeVerdict: { score: 0, reasoning: '' } }),
      makeResult({ id: 'r2', testCaseId: 'c1', outputText: 'B', judgeVerdict: { score: 5, reasoning: '' } }),
      makeResult({ id: 'r3', testCaseId: 'c1', outputText: 'C', judgeVerdict: { score: 10, reasoning: '' } }),
    ];
    // pop std of [0,5,10] = sqrt(((25+0+25)/3)) = sqrt(50/3) ≈ 4.08 > 1.0

    const summary = computeSummary('behavior', cases, results);
    expect(summary.cases[0]?.isOutlier).toBe(true);
    expect(summary.outliers).toContain('c1');
  });
});

// ── 6.1.2: tool_use rollup ───────────────────────────────────────────────────

describe('computeSummary – tool_use type', () => {
  test('computes toolSelectionEntropy, toolSelectionHitRate and argumentSchemaConformanceRate', () => {
    const cases = [
      makeCase('c1', { query: 'weather in Berlin' }),
    ];
    // The case has an expected tool
    cases[0]!.expected = {
      tool: 'get_weather',
      arguments: { city: 'Berlin' },
    };

    const results: Result[] = [
      makeResult({
        id: 'r1', testCaseId: 'c1', repeatIndex: 0,
        toolCalls: [{ name: 'get_weather', argumentsRaw: '{"city":"Berlin"}', argumentsParsed: { city: 'Berlin' } }],
        usage: { promptTokens: 8, completionTokens: 4, costUsd: 0.0005 },
      }),
      makeResult({
        id: 'r2', testCaseId: 'c1', repeatIndex: 1,
        toolCalls: [{ name: 'get_weather', argumentsRaw: '{"city":"Berlin"}', argumentsParsed: { city: 'Berlin' } }],
        usage: { promptTokens: 8, completionTokens: 4, costUsd: 0.0005 },
      }),
    ];

    const summary = computeSummary('tool_use', cases, results);

    expect(summary.type).toBe('tool_use');
    expect(summary.totalCostUsd).toBeCloseTo(0.001);

    const c = summary.cases[0]!;
    expect(c.testCaseId).toBe('c1');
    expect(c.label).toBe('weather in Berlin');
    expect(c.repeatCount).toBe(2);
    expect(c.errorCount).toBe(0);
    // Both calls are same tool → entropy = 0
    expect(c.toolSelectionEntropy).toBe(0);
    // Both hit expected tool → hitRate = 1.0
    expect(c.toolSelectionHitRate).toBe(1.0);
    // No schema provided (no toolSchema) → conformanceRate = 0 (fail-closed)
    // Note: conformanceRate is computed from toolUseMetrics without schema
    expect(c.argumentSchemaConformanceRate).toBeDefined();
    expect(c.isOutlier).toBe(false); // entropy=0, not > 0.5
  });

  test('high-entropy tool_use case is flagged as outlier', () => {
    const cases = [makeCase('c1', { query: 'x' })];
    cases[0]!.expected = { tool: 'tool_a' };

    const results: Result[] = [
      makeResult({ id: 'r1', testCaseId: 'c1', toolCalls: [{ name: 'tool_a', argumentsRaw: '{}' }] }),
      makeResult({ id: 'r2', testCaseId: 'c1', toolCalls: [{ name: 'tool_b', argumentsRaw: '{}' }] }),
    ];
    // two distinct tools in equal proportion → entropy = 1 bit > 0.5

    const summary = computeSummary('tool_use', cases, results);
    expect(summary.cases[0]?.isOutlier).toBe(true);
    expect(summary.outliers).toContain('c1');
  });
});

// ── 6.1.3: error results are counted and do not crash rollup ─────────────────

describe('computeSummary – error handling', () => {
  test('error result is counted and does not crash the rollup', () => {
    const cases = [makeCase('c1', { article: 'test' })];
    const results: Result[] = [
      makeResult({
        id: 'r1', testCaseId: 'c1', repeatIndex: 0,
        outputText: 'OK',
        judgeVerdict: { score: 4, reasoning: '' },
        usage: { promptTokens: 5, completionTokens: 2, costUsd: 0.001 },
      }),
      makeResult({
        id: 'r2', testCaseId: 'c1', repeatIndex: 1,
        status: 'error', error: 'timeout',
        usage: { promptTokens: 3, completionTokens: 0, costUsd: 0.0005 },
      }),
    ];

    const summary = computeSummary('behavior', cases, results);

    expect(summary.errorCount).toBe(1);
    expect(summary.cases[0]?.errorCount).toBe(1);
    expect(summary.cases[0]?.repeatCount).toBe(2);
    // totalCostUsd includes error result's cost
    expect(summary.totalCostUsd).toBeCloseTo(0.0015);
    // scoreMean only from the ok result
    expect(summary.cases[0]?.scoreMean).toBeCloseTo(4);
  });

  test('totalCostUsd treats missing costUsd as 0 (never NaN)', () => {
    const cases = [makeCase('c1')];
    const results: Result[] = [
      makeResult({ id: 'r1', testCaseId: 'c1', usage: { promptTokens: 5, completionTokens: 2 } }),
      makeResult({ id: 'r2', testCaseId: 'c1', usage: undefined }),
    ];

    const summary = computeSummary('behavior', cases, results);
    expect(summary.totalCostUsd).toBe(0);
    expect(Number.isNaN(summary.totalCostUsd)).toBe(false);
  });
});
