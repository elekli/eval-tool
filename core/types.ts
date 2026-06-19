export type EvalType = 'behavior' | 'tool_use';
export type OwnerId = string;                 // v1 fixed 'local'

export interface VirtualToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;        // JSON Schema object
}

export interface TargetConfig {
  model: string;                              // e.g. 'openai/gpt-4o-mini'
  systemPrompt: string;
  userPromptTemplate: string;                 // may reference {{var}}
  temperature?: number;
  tools?: VirtualToolDef[];                   // tool_use only
}

export interface JudgeConfig {
  enabled: boolean;
  model: string;
  rubric: string;
}

export interface RunConfig { nRepeats: number; }

export interface Suite {
  id: string;
  ownerId: OwnerId;
  name: string;
  type: EvalType;
  target: TargetConfig;
  judge: JudgeConfig | null;
  runConfig: RunConfig;
  createdAt: number;
}

export interface GenSpec {
  languages: string[];
  countPerLang: number;
  lengthWords: number;
  topic: string;
  extra?: string;
}

export interface TestCase {
  id: string;
  datasetId: string;
  vars: Record<string, string>;
  expected?: { tool?: string; arguments?: Record<string, unknown> };
}

export interface Dataset {
  id: string;
  ownerId: OwnerId;
  name: string;
  source: 'manual' | 'generated';
  genSpec?: GenSpec;
  createdAt: number;
}

export type RunStatus = 'queued' | 'running' | 'done' | 'error';
export interface Run {
  id: string;
  ownerId: OwnerId;
  suiteId: string;
  datasetId: string;
  status: RunStatus;
  nRepeats: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

export interface ToolCall { name: string; argumentsRaw: string; argumentsParsed?: unknown; }
export interface Usage { promptTokens: number; completionTokens: number; costUsd?: number; }
export interface JudgeVerdict { score: number; reasoning: string; }

export type ResultStatus = 'ok' | 'error';
export interface Result {
  id: string;
  runId: string;
  testCaseId: string;
  repeatIndex: number;
  status: ResultStatus;
  outputText?: string;
  toolCalls?: ToolCall[];
  judgeVerdict?: JudgeVerdict;
  metrics?: Record<string, number>;
  usage?: Usage;
  error?: string;
  createdAt: number;
}
