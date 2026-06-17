import type Database from 'better-sqlite3';
import type { Repository } from './repository';
import type { Suite, Dataset, TestCase, Run, Result, JudgeConfig, GenSpec } from '../types';
import { SCHEMA_SQL } from './schema';

// Row types matching the DB schema
interface SuiteRow {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  target_config: string;
  judge_config: string | null;
  run_config: string;
  created_at: number;
}

interface DatasetRow {
  id: string;
  owner_id: string;
  name: string;
  source: string;
  gen_spec: string | null;
  created_at: number;
}

interface TestCaseRow {
  id: string;
  dataset_id: string;
  vars: string;
  expected: string | null;
}

interface RunRow {
  id: string;
  owner_id: string;
  suite_id: string;
  dataset_id: string;
  status: string;
  n_repeats: number;
  started_at: number | null;
  finished_at: number | null;
  error: string | null;
}

interface ResultRow {
  id: string;
  run_id: string;
  test_case_id: string;
  repeat_index: number;
  status: string;
  output_text: string | null;
  tool_calls: string | null;
  judge_verdict: string | null;
  metrics: string | null;
  usage: string | null;
  error: string | null;
  created_at: number;
}

export class SQLiteRepo implements Repository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.db.exec(SCHEMA_SQL);
  }

  // --- private row → domain helpers ---

  private rowToSuite(row: SuiteRow): Suite {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      type: row.type as Suite['type'],
      target: JSON.parse(row.target_config) as Suite['target'],
      judge: row.judge_config ? (JSON.parse(row.judge_config) as JudgeConfig) : null,
      runConfig: JSON.parse(row.run_config) as Suite['runConfig'],
      createdAt: row.created_at,
    };
  }

  private rowToDataset(row: DatasetRow): Dataset {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      source: row.source as Dataset['source'],
      genSpec: row.gen_spec !== null ? (JSON.parse(row.gen_spec) as GenSpec) : undefined,
      createdAt: row.created_at,
    };
  }

  private rowToTestCase(row: TestCaseRow): TestCase {
    return {
      id: row.id,
      datasetId: row.dataset_id,
      vars: JSON.parse(row.vars) as Record<string, string>,
      expected: row.expected !== null ? (JSON.parse(row.expected) as TestCase['expected']) : undefined,
    };
  }

  private rowToRun(row: RunRow): Run {
    return {
      id: row.id,
      ownerId: row.owner_id,
      suiteId: row.suite_id,
      datasetId: row.dataset_id,
      status: row.status as Run['status'],
      nRepeats: row.n_repeats,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      error: row.error,
    };
  }

  private rowToResult(row: ResultRow): Result {
    return {
      id: row.id,
      runId: row.run_id,
      testCaseId: row.test_case_id,
      repeatIndex: row.repeat_index,
      status: row.status as Result['status'],
      outputText: row.output_text ?? undefined,
      toolCalls: row.tool_calls !== null ? (JSON.parse(row.tool_calls) as Result['toolCalls']) : undefined,
      judgeVerdict: row.judge_verdict !== null ? (JSON.parse(row.judge_verdict) as Result['judgeVerdict']) : undefined,
      metrics: row.metrics !== null ? (JSON.parse(row.metrics) as Record<string, number>) : undefined,
      usage: row.usage !== null ? (JSON.parse(row.usage) as Result['usage']) : undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at,
    };
  }

  // --- suites ---

  createSuite(s: Suite): void {
    const stmt = this.db.prepare(
      `INSERT INTO suites (id, owner_id, name, type, target_config, judge_config, run_config, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      s.id, s.ownerId, s.name, s.type,
      JSON.stringify(s.target),
      s.judge !== null ? JSON.stringify(s.judge) : null,
      JSON.stringify(s.runConfig),
      s.createdAt
    );
  }

  getSuite(id: string): Suite | null {
    const stmt = this.db.prepare<[string], SuiteRow>('SELECT * FROM suites WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.rowToSuite(row) : null;
  }

  listSuites(ownerId: string): Suite[] {
    const stmt = this.db.prepare<[string], SuiteRow>('SELECT * FROM suites WHERE owner_id = ?');
    return stmt.all(ownerId).map(r => this.rowToSuite(r));
  }

  updateSuite(s: Suite): void {
    const stmt = this.db.prepare(
      `UPDATE suites SET owner_id=?, name=?, type=?, target_config=?, judge_config=?, run_config=?, created_at=?
       WHERE id=?`
    );
    stmt.run(
      s.ownerId, s.name, s.type,
      JSON.stringify(s.target),
      s.judge !== null ? JSON.stringify(s.judge) : null,
      JSON.stringify(s.runConfig),
      s.createdAt, s.id
    );
  }

  deleteSuite(id: string): void {
    this.db.prepare('DELETE FROM suites WHERE id = ?').run(id);
  }

  // --- datasets + cases ---

  createDataset(d: Dataset, cases: TestCase[]): void {
    const insertDataset = this.db.prepare(
      `INSERT INTO datasets (id, owner_id, name, source, gen_spec, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    );
    const insertCase = this.db.prepare(
      `INSERT INTO test_cases (id, dataset_id, vars, expected) VALUES (?, ?, ?, ?)`
    );

    const tx = this.db.transaction(() => {
      insertDataset.run(
        d.id, d.ownerId, d.name, d.source,
        d.genSpec !== undefined ? JSON.stringify(d.genSpec) : null,
        d.createdAt
      );
      for (const c of cases) {
        insertCase.run(
          c.id, c.datasetId,
          JSON.stringify(c.vars),
          c.expected !== undefined ? JSON.stringify(c.expected) : null
        );
      }
    });
    tx();
  }

  getDataset(id: string): Dataset | null {
    const stmt = this.db.prepare<[string], DatasetRow>('SELECT * FROM datasets WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.rowToDataset(row) : null;
  }

  listTestCases(datasetId: string): TestCase[] {
    const stmt = this.db.prepare<[string], TestCaseRow>('SELECT * FROM test_cases WHERE dataset_id = ?');
    return stmt.all(datasetId).map(r => this.rowToTestCase(r));
  }

  // --- runs + results ---

  createRun(r: Run): void {
    const stmt = this.db.prepare(
      `INSERT INTO runs (id, owner_id, suite_id, dataset_id, status, n_repeats, started_at, finished_at, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      r.id, r.ownerId, r.suiteId, r.datasetId,
      r.status, r.nRepeats,
      r.startedAt, r.finishedAt, r.error
    );
  }

  getRun(id: string): Run | null {
    const stmt = this.db.prepare<[string], RunRow>('SELECT * FROM runs WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.rowToRun(row) : null;
  }

  updateRun(r: Run): void {
    const stmt = this.db.prepare(
      `UPDATE runs SET owner_id=?, suite_id=?, dataset_id=?, status=?, n_repeats=?,
       started_at=?, finished_at=?, error=? WHERE id=?`
    );
    stmt.run(
      r.ownerId, r.suiteId, r.datasetId, r.status, r.nRepeats,
      r.startedAt, r.finishedAt, r.error, r.id
    );
  }

  insertResult(r: Result): void {
    const stmt = this.db.prepare(
      `INSERT INTO results (id, run_id, test_case_id, repeat_index, status, output_text,
       tool_calls, judge_verdict, metrics, usage, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      r.id, r.runId, r.testCaseId, r.repeatIndex, r.status,
      r.outputText ?? null,
      r.toolCalls !== undefined ? JSON.stringify(r.toolCalls) : null,
      r.judgeVerdict !== undefined ? JSON.stringify(r.judgeVerdict) : null,
      r.metrics !== undefined ? JSON.stringify(r.metrics) : null,
      r.usage !== undefined ? JSON.stringify(r.usage) : null,
      r.error ?? null,
      r.createdAt
    );
  }

  listResults(runId: string): Result[] {
    const stmt = this.db.prepare<[string], ResultRow>('SELECT * FROM results WHERE run_id = ?');
    return stmt.all(runId).map(r => this.rowToResult(r));
  }
}
