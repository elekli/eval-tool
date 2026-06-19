import { randomUUID } from 'crypto';
import type { Repository } from '../storage/repository';
import type { Runner } from '../runner/runner';
import type { JudgeConfig, Result, Usage } from '../types';
import type { JudgeResult } from '../judge/judge';

// Minimal interface so we don't hard-depend on the concrete Judge class
export interface JudgeLike {
  evaluate(
    judgeConfig: JudgeConfig,
    payload: { input: Record<string, unknown>; output: string },
  ): Promise<JudgeResult>;
}

// ── Bounded concurrency pool ──────────────────────────────────────────────────

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      const task = tasks[index]!;
      results[index] = await task();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── JobRunner ─────────────────────────────────────────────────────────────────

export class JobRunner {
  private repo: Repository;
  private runner: Runner;
  private judge: JudgeLike;
  private concurrency: number;

  constructor(repo: Repository, runner: Runner, judge: JudgeLike, concurrency = 4) {
    this.repo = repo;
    this.runner = runner;
    this.judge = judge;
    this.concurrency = concurrency;
  }

  async execute(runId: string): Promise<void> {
    // ── 1. Load run ──────────────────────────────────────────────────────────
    const run = this.repo.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    // ── 2. Load suite ────────────────────────────────────────────────────────
    const suite = this.repo.getSuite(run.suiteId);
    if (!suite) {
      await this.markRunError(runId, run, `Suite not found: ${run.suiteId}`);
      throw new Error(`Suite not found: ${run.suiteId}`);
    }

    // ── 3. Load dataset + cases ───────────────────────────────────────────────
    const dataset = this.repo.getDataset(run.datasetId);
    if (!dataset) {
      await this.markRunError(runId, run, `Dataset not found: ${run.datasetId}`);
      throw new Error(`Dataset not found: ${run.datasetId}`);
    }
    const cases = this.repo.listTestCases(run.datasetId);

    // ── 4. Set run → running ──────────────────────────────────────────────────
    this.repo.updateRun({
      ...run,
      status: 'running',
      startedAt: Date.now(),
    });

    // ── 5. Build work list: cases × nRepeats ──────────────────────────────────
    const nRepeats = suite.runConfig.nRepeats;
    const workItems: Array<{ testCaseId: string; repeatIndex: number }> = [];
    for (const tc of cases) {
      for (let i = 0; i < nRepeats; i++) {
        workItems.push({ testCaseId: tc.id, repeatIndex: i });
      }
    }

    // ── 6. Execute with bounded concurrency ───────────────────────────────────
    const tasks = workItems.map(({ testCaseId, repeatIndex }) => async () => {
      const testCase = cases.find((c) => c.id === testCaseId)!;

      let result: Result;
      try {
        // Each repeat is an independent runner.run call
        const record = await this.runner.run(suite.target, testCase);

        const runnerCost = record.usage?.costUsd ?? 0;
        let judgeVerdict: Result['judgeVerdict'] = undefined;
        let totalCostUsd = runnerCost;

        // Judge only for behavior type with judge enabled
        if (suite.type === 'behavior' && suite.judge?.enabled) {
          const judgeResult = await this.judge.evaluate(suite.judge, {
            input: testCase.vars as Record<string, unknown>,
            output: record.text ?? '',
          });
          judgeVerdict = judgeResult.verdict;
          // Fold judge usage cost into total
          totalCostUsd = runnerCost + (judgeResult.usage.costUsd ?? 0);
        }

        // Build merged usage (runner tokens + judge cost folded in)
        const mergedUsage: Usage | undefined = record.usage
          ? {
              promptTokens: record.usage.promptTokens,
              completionTokens: record.usage.completionTokens,
              costUsd: totalCostUsd,
            }
          : undefined;

        result = {
          id: randomUUID(),
          runId,
          testCaseId,
          repeatIndex,
          status: 'ok',
          outputText: record.text,
          toolCalls: record.toolCalls,
          judgeVerdict,
          usage: mergedUsage,
          createdAt: Date.now(),
        };
      } catch (err) {
        result = {
          id: randomUUID(),
          runId,
          testCaseId,
          repeatIndex,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
          createdAt: Date.now(),
        };
      }

      this.repo.insertResult(result);
    });

    await runWithConcurrency(tasks, this.concurrency);

    // ── 7. Mark run done ──────────────────────────────────────────────────────
    const updatedRun = this.repo.getRun(runId);
    if (updatedRun) {
      this.repo.updateRun({
        ...updatedRun,
        status: 'done',
        finishedAt: Date.now(),
      });
    }
  }

  private async markRunError(runId: string, run: { ownerId: string; suiteId: string; datasetId: string; status: string; nRepeats: number; startedAt: number | null; finishedAt: number | null; error: string | null }, message: string): Promise<void> {
    this.repo.updateRun({
      id: runId,
      ownerId: run.ownerId,
      suiteId: run.suiteId,
      datasetId: run.datasetId,
      status: 'error',
      nRepeats: run.nRepeats,
      startedAt: run.startedAt,
      finishedAt: Date.now(),
      error: message,
    });
  }
}
