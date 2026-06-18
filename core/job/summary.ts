import type { EvalType, TestCase, Result } from '../types';
import { scoreStats, distinctOutputs, toolUseMetrics } from '../metrics';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CaseSummary {
  testCaseId: string;
  label: string;              // first non-empty value in the case's vars, else testCaseId
  repeatCount: number;
  errorCount: number;
  // behaviour (present when type==='behavior' and judge ran)
  scoreMean?: number;
  scoreStd?: number;
  distinctOutputCount?: number;
  // tool_use (present when type==='tool_use')
  toolSelectionEntropy?: number;
  toolSelectionHitRate?: number;
  argumentSchemaConformanceRate?: number;
  isOutlier: boolean;
}

export interface Summary {
  type: EvalType;
  cases: CaseSummary[];
  totalCostUsd: number;       // sum of usage.costUsd, MISSING → 0 (never NaN)
  errorCount: number;         // total error results
  outliers: string[];         // testCaseIds flagged isOutlier
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLabel(testCase: TestCase): string {
  // First non-empty value in vars, else testCaseId
  for (const val of Object.values(testCase.vars)) {
    if (val !== '') return val;
  }
  return testCase.id;
}

// ── Main function ─────────────────────────────────────────────────────────────

export function computeSummary(
  type: EvalType,
  cases: TestCase[],
  results: Result[],
): Summary {
  // Group results by testCaseId
  const byCase = new Map<string, Result[]>();
  for (const result of results) {
    const group = byCase.get(result.testCaseId) ?? [];
    group.push(result);
    byCase.set(result.testCaseId, group);
  }

  // totalCostUsd: sum across all results, missing → 0
  const totalCostUsd = results.reduce((sum, r) => {
    const cost = r.usage?.costUsd ?? 0;
    return sum + cost;
  }, 0);

  // total error count
  const errorCount = results.filter((r) => r.status === 'error').length;

  const outliers: string[] = [];

  const caseSummaries: CaseSummary[] = cases.map((testCase) => {
    const caseResults = byCase.get(testCase.id) ?? [];
    const label = getLabel(testCase);
    const repeatCount = caseResults.length;
    const caseErrorCount = caseResults.filter((r) => r.status === 'error').length;

    let caseSummary: CaseSummary;

    if (type === 'behavior') {
      // Only look at ok results for score computation
      const okResults = caseResults.filter((r) => r.status === 'ok');
      const scores = okResults
        .map((r) => r.judgeVerdict?.score)
        .filter((s): s is number => s !== undefined);
      const outputTexts = okResults
        .map((r) => r.outputText)
        .filter((t): t is string => t !== undefined);

      let scoreMean: number | undefined;
      let scoreStd: number | undefined;

      if (scores.length > 0) {
        const stats = scoreStats(scores);
        scoreMean = stats.mean;
        scoreStd = stats.std;
      }

      const distinctOutputCount = outputTexts.length > 0
        ? distinctOutputs(outputTexts)
        : undefined;

      const isOutlier = scoreStd !== undefined && scoreStd > 1.0;

      caseSummary = {
        testCaseId: testCase.id,
        label,
        repeatCount,
        errorCount: caseErrorCount,
        scoreMean,
        scoreStd,
        distinctOutputCount,
        isOutlier,
      };
    } else {
      // tool_use
      // Collect all tool calls from all results for this case
      const allCalls = caseResults.flatMap((r) => r.toolCalls ?? []);

      let toolSelectionEntropy: number | undefined;
      let toolSelectionHitRate: number | undefined;
      let argumentSchemaConformanceRate: number | undefined;

      if (allCalls.length > 0) {
        const metrics = toolUseMetrics({
          expectedTool: testCase.expected?.tool,
          calls: allCalls,
        });
        toolSelectionEntropy = metrics.toolSelectionEntropy;
        toolSelectionHitRate = metrics.toolSelectionHitRate;
        argumentSchemaConformanceRate = metrics.argumentSchemaConformanceRate;
      } else {
        // No calls at all — zero entropy, conformance undefined
        toolSelectionEntropy = 0;
        argumentSchemaConformanceRate = 0;
      }

      const isOutlier = toolSelectionEntropy !== undefined && toolSelectionEntropy > 0.5;

      caseSummary = {
        testCaseId: testCase.id,
        label,
        repeatCount,
        errorCount: caseErrorCount,
        toolSelectionEntropy,
        toolSelectionHitRate,
        argumentSchemaConformanceRate,
        isOutlier,
      };
    }

    if (caseSummary.isOutlier) {
      outliers.push(testCase.id);
    }

    return caseSummary;
  });

  return {
    type,
    cases: caseSummaries,
    totalCostUsd,
    errorCount,
    outliers,
  };
}
