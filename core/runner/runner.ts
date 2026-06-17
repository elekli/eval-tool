import type { TargetConfig, TestCase, ToolCall, Usage } from '../types';
export interface ExecutionRecord { text?: string; toolCalls?: ToolCall[]; usage?: Usage; raw?: unknown; }
export interface Runner { run(target: TargetConfig, testCase: TestCase): Promise<ExecutionRecord>; }
