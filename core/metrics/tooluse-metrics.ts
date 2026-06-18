import type { ToolCall, VirtualToolDef } from '../types';
import { toolSelectionEntropy } from './entropy';
import { validArguments } from './schema-conformance';

export interface ToolUseMetricsInput {
  /** When given, compute toolSelectionHitRate. */
  expectedTool?: string;
  /**
   * When given, a conforming call must have a resolvable schema AND valid args.
   * Used for the legacy single-schema path (e.g. unit tests that pass one schema directly).
   * If `tools` is also given, `tools` wins for per-call schema resolution.
   */
  toolSchema?: object;
  /**
   * Full set of available tool definitions (from suite.target.tools).
   * When provided, conformance is resolved per-call by matching the call's `name`
   * against the tool definition list, then validating args against that tool's schema.
   * Calls whose tool name has no matching definition are non-conformant (fail-closed).
   */
  tools?: VirtualToolDef[];
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
  const { expectedTool, toolSchema, tools, expected, calls } = input;

  // Tool-selection hit rate: fraction of calls whose name === expectedTool
  const toolSelectionHitRate =
    expectedTool !== undefined
      ? calls.filter((c) => c.name === expectedTool).length / calls.length
      : undefined;

  // Entropy over all call names
  const entropy = toolSelectionEntropy(calls.map((c) => c.name));

  // Build per-name schema index when tools[] is provided.
  // This is the preferred path for real runs: suite.target.tools → schemaByName.
  const schemaByName: Map<string, object> | null = tools
    ? new Map(tools.map((t) => [t.name, t.parameters as object]))
    : null;

  // Conformance: denominator is ALL calls (fail-closed).
  // Priority:
  //   1. If `tools` array given → resolve schema by call.name from schemaByName.
  //   2. Else if `toolSchema` given → legacy single-schema path:
  //      apply schema only to calls whose name matches `expectedTool` (if given),
  //      or to all calls when no `expectedTool` is specified.
  //   3. Neither given → conformingCount = 0.
  const conformingCount = calls.filter((c) => {
    if (schemaByName) {
      // Per-call schema resolution from the tools list
      const schema = schemaByName.get(c.name);
      if (!schema) return false; // no schema for this tool → non-conformant
      return validArguments(schema, c.argumentsParsed);
    }
    if (toolSchema) {
      // Legacy: single schema, optionally filtered by expectedTool
      if (expectedTool !== undefined && c.name !== expectedTool) return false;
      return validArguments(toolSchema, c.argumentsParsed);
    }
    return false;
  }).length;
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
