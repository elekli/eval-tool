import type { ToolCall } from '../types';
import { toolSelectionEntropy } from './entropy';
import { validArguments } from './schema-conformance';

export interface ToolUseMetricsInput {
  /** When given, compute toolSelectionHitRate. */
  expectedTool?: string;
  /** When given, a conforming call must have a resolvable schema AND valid args. */
  toolSchema?: object;
  /** When given, compute argumentExactMatch via deep-equal against first call's parsed args. */
  expected?: { arguments?: Record<string, unknown> };
  calls: Pick<ToolCall, 'name' | 'argumentsRaw' | 'argumentsParsed'>[];
}

export interface ToolUseMetricsResult {
  /** Fraction of calls whose name === expectedTool. Only present when expectedTool given. */
  toolSelectionHitRate?: number;
  /** Shannon entropy (bits) of the distribution of tool names called. */
  toolSelectionEntropy: number;
  /**
   * Fraction of ALL calls that are conformant.
   * A call conforms iff it has a resolvable schema AND validArguments passes.
   * Calls whose tool has no resolvable schema count as non-conformant (fail-closed).
   */
  argumentSchemaConformanceRate: number;
  /** Deep-equal check between first call's parsed args and expected.arguments. Only present when expected.arguments given. */
  argumentExactMatch?: boolean;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

export function toolUseMetrics(input: ToolUseMetricsInput): ToolUseMetricsResult {
  const { expectedTool, toolSchema, expected, calls } = input;

  // Tool-selection hit rate: fraction of calls whose name === expectedTool
  const toolSelectionHitRate =
    expectedTool !== undefined
      ? calls.filter((c) => c.name === expectedTool).length / calls.length
      : undefined;

  // Entropy over all call names
  const entropy = toolSelectionEntropy(calls.map((c) => c.name));

  // Conformance: denominator is ALL calls.
  // A call conforms iff toolSchema is given AND validArguments(toolSchema, c.argumentsParsed) is true.
  // For calls whose tool has no resolvable schema → non-conformant (fail-closed).
  const conformingCount = toolSchema
    ? calls.filter((c) => {
        // Only calls to the expected tool (the one whose schema we have) can conform.
        // For any other tool name, there's no schema → fail-closed.
        if (expectedTool !== undefined && c.name !== expectedTool) return false;
        // If no expectedTool but toolSchema provided, apply schema to all calls.
        return validArguments(toolSchema, c.argumentsParsed);
      }).length
    : 0;
  const argumentSchemaConformanceRate = conformingCount / calls.length;

  // Argument exact match: compare first call's parsed args to expected.arguments
  let argumentExactMatch: boolean | undefined;
  if (expected?.arguments !== undefined) {
    const firstCall = calls[0];
    argumentExactMatch = firstCall !== undefined
      ? deepEqual(firstCall.argumentsParsed, expected.arguments)
      : false;
  }

  return {
    toolSelectionHitRate,
    toolSelectionEntropy: entropy,
    argumentSchemaConformanceRate,
    ...(argumentExactMatch !== undefined ? { argumentExactMatch } : {}),
  };
}
