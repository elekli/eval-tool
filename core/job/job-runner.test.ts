import { describe, test, expect } from 'vitest';
import Database from 'better-sqlite3';
import { SQLiteRepo } from '../storage/sqlite-repo';
import { JobRunner } from './job-runner';
import type { Runner, ExecutionRecord } from '../runner/runner';
import type { JudgeConfig, Suite, Dataset, TestCase, Run } from '../types';
import type { JudgeResult } from '../judge/judge';

// ── Stub/spy helpers ──────────────────────────────────────────────────────────

function makeRepo() {
  return new SQLiteRepo(new Database(':memory:'));
}

function makeRunner(record: ExecutionRecord = {}): { runner: Runner; callCount: () => number } {
  let count = 0;
  const runner: Runner = {
    async run() {
      count++;
      return record;
    },
  };
  return { runner, callCount: () => count };
}

function makeFailingRunner(failOnCall: number, fallback: ExecutionRecord = {}): Runner {
  let count = 0;
  return {
    async run() {
      count++;
      if (count === failOnCall) throw new Error('runner-error');
      return fallback;
    },
  };
}

function makeJudge(score = 4): { judge: ConstructorParameters<typeof JobRunner>[2]; callCount: () => number } {
  let count = 0;
  const judge = {
    async evaluate(cfg: JudgeConfig, payload: { input: Record<string, unknown>; output: string }): Promise<JudgeResult> {
      void cfg; void payload;
      count++;
      return {
        verdict: { score, reasoning: 'ok' },
        usage: { promptTokens: 5, completionTokens: 2, costUsd: 0.0002 },
      };
    },
  };
  return { judge, callCount: () => count };
}

// ── DB fixtures ────────────────────────────────────────────────────────────────

const suite: Suite = {
  id: 'suite1',
  ownerId: 'local',
  name: 'My Suite',
  type: 'behavior',
  target: { model: 'openai/gpt-4o-mini', systemPrompt: 'sys', userPromptTemplate: '{{article}}' },
  judge: { enabled: true, model: 'judge-model', rubric: 'concise?' },
  runConfig: { nRepeats: 2 },
  createdAt: 1,
};

const dataset: Dataset = {
  id: 'ds1',
  ownerId: 'local',
  name: 'DS',
  source: 'manual',
  createdAt: 1,
};

const cases: TestCase[] = [
  { id: 'c1', datasetId: 'ds1', vars: { article: 'hello' } },
  { id: 'c2', datasetId: 'ds1', vars: { article: 'world' } },
];

const run: Run = {
  id: 'run1',
  ownerId: 'local',
  suiteId: 'suite1',
  datasetId: 'ds1',
  status: 'queued',
  nRepeats: 2,
  startedAt: null,
  finishedAt: null,
  error: null,
};

function seedDb(repo: SQLiteRepo, customSuite?: Suite, customRun?: Run) {
  repo.createSuite(customSuite ?? suite);
  repo.createDataset(dataset, cases);
  repo.createRun(customRun ?? run);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('JobRunner.execute', () => {
  test('runs nRepeats × cases results and marks run done', async () => {
    const repo = makeRepo();
    seedDb(repo);
    const { runner, callCount } = makeRunner({ text: 'some output' });
    const { judge } = makeJudge();

    const jobRunner = new JobRunner(repo, runner, judge);
    await jobRunner.execute('run1');

    // 2 cases × 2 repeats = 4 runner calls
    expect(callCount()).toBe(4);

    const results = repo.listResults('run1');
    expect(results).toHaveLength(4);
    expect(results.every((r) => r.status === 'ok')).toBe(true);

    const finalRun = repo.getRun('run1');
    expect(finalRun?.status).toBe('done');
    expect(finalRun?.startedAt).not.toBeNull();
    expect(finalRun?.finishedAt).not.toBeNull();
  });

  test('each repeat is an independent runner call (not n>1 sampling)', async () => {
    const repo = makeRepo();
    // nRepeats=3, 1 case → 3 independent calls
    const singleCaseDataset: Dataset = { ...dataset, id: 'ds2' };
    const singleCase: TestCase = { id: 'sc1', datasetId: 'ds2', vars: { article: 'a' } };
    const singleRun: Run = { ...run, id: 'run2', suiteId: 'suite2', datasetId: 'ds2', nRepeats: 3 };

    repo.createSuite({ ...suite, id: 'suite2', runConfig: { nRepeats: 3 } });
    repo.createDataset(singleCaseDataset, [singleCase]);
    repo.createRun(singleRun);

    const { runner, callCount } = makeRunner({ text: 'output' });
    const { judge } = makeJudge();

    await new JobRunner(repo, runner, judge).execute('run2');

    expect(callCount()).toBe(3);
    const results = repo.listResults('run2');
    expect(results).toHaveLength(3);
    // Each has a distinct repeatIndex
    const indices = results.map((r) => r.repeatIndex).sort();
    expect(indices).toEqual([0, 1, 2]);
  });

  test('a runner that throws once yields an error result while the run still completes done', async () => {
    const repo = makeRepo();
    // 1 case × 2 repeats: first call throws, second succeeds
    const singleCaseDs: Dataset = { ...dataset, id: 'ds3' };
    const singleCase: TestCase = { id: 'fc1', datasetId: 'ds3', vars: { article: 'x' } };
    repo.createSuite({ ...suite, id: 'suite3', runConfig: { nRepeats: 2 } });
    repo.createDataset(singleCaseDs, [singleCase]);
    repo.createRun({ ...run, id: 'run3', suiteId: 'suite3', datasetId: 'ds3', nRepeats: 2 });

    const failingRunner = makeFailingRunner(1, { text: 'ok' }); // first call fails
    const { judge } = makeJudge();

    await new JobRunner(repo, failingRunner, judge).execute('run3');

    const results = repo.listResults('run3');
    expect(results).toHaveLength(2);

    const errorResult = results.find((r) => r.status === 'error');
    const okResult = results.find((r) => r.status === 'ok');

    expect(errorResult).toBeDefined();
    expect(errorResult?.error).toContain('runner-error');
    expect(okResult).toBeDefined();

    // Run must still be done despite per-item error
    const finalRun = repo.getRun('run3');
    expect(finalRun?.status).toBe('done');
  });

  test('judge is called for behavior runs and verdict + judge usage is stored in result', async () => {
    const repo = makeRepo();
    // 1 case × 1 repeat
    const ds: Dataset = { ...dataset, id: 'ds4' };
    const tc: TestCase = { id: 'jc1', datasetId: 'ds4', vars: { article: 'test' } };
    repo.createSuite({ ...suite, id: 'suite4', runConfig: { nRepeats: 1 } });
    repo.createDataset(ds, [tc]);
    repo.createRun({ ...run, id: 'run4', suiteId: 'suite4', datasetId: 'ds4', nRepeats: 1 });

    const { runner } = makeRunner({ text: 'model output', usage: { promptTokens: 10, completionTokens: 5, costUsd: 0.001 } });
    const { judge, callCount } = makeJudge(7);

    await new JobRunner(repo, runner, judge).execute('run4');

    expect(callCount()).toBe(1); // judge called once

    const results = repo.listResults('run4');
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.judgeVerdict?.score).toBe(7);
    // Total cost = runner (0.001) + judge (0.0002)
    expect(r.usage?.costUsd).toBeCloseTo(0.0012);
  });

  test('judge is NOT called for tool_use suites', async () => {
    const repo = makeRepo();
    const ds: Dataset = { ...dataset, id: 'ds5' };
    const tc: TestCase = { id: 'tu1', datasetId: 'ds5', vars: { query: 'weather' } };
    const toolSuite: Suite = {
      ...suite, id: 'suite5',
      type: 'tool_use',
      runConfig: { nRepeats: 1 },
    };
    repo.createSuite(toolSuite);
    repo.createDataset(ds, [tc]);
    repo.createRun({ ...run, id: 'run5', suiteId: 'suite5', datasetId: 'ds5', nRepeats: 1 });

    const { runner } = makeRunner({ toolCalls: [{ name: 'get_weather', argumentsRaw: '{}' }] });
    const { judge, callCount } = makeJudge();

    await new JobRunner(repo, runner, judge).execute('run5');

    expect(callCount()).toBe(0); // judge never called for tool_use
    const results = repo.listResults('run5');
    expect(results[0]?.judgeVerdict).toBeUndefined();
  });

  test('setup error (missing suite) sets run to error status', async () => {
    const repo = makeRepo();
    repo.createRun({ ...run, id: 'run6', suiteId: 'no-such-suite' });
    const { runner } = makeRunner();
    const { judge } = makeJudge();

    await expect(new JobRunner(repo, runner, judge).execute('run6')).rejects.toThrow();
    const finalRun = repo.getRun('run6');
    expect(finalRun?.status).toBe('error');
  });
});
