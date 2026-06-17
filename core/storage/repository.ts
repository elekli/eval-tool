// core/storage/repository.ts
import type { Suite, Dataset, TestCase, Run, Result } from '../types';

export interface Repository {
  // suites
  createSuite(s: Suite): void;
  getSuite(id: string): Suite | null;
  listSuites(ownerId: string): Suite[];
  updateSuite(s: Suite): void;
  deleteSuite(id: string): void;
  // datasets + cases
  createDataset(d: Dataset, cases: TestCase[]): void;
  getDataset(id: string): Dataset | null;
  listTestCases(datasetId: string): TestCase[];
  // runs + results
  createRun(r: Run): void;
  getRun(id: string): Run | null;
  updateRun(r: Run): void;
  insertResult(r: Result): void;
  listResults(runId: string): Result[];
}
