// Single source of truth for DDL — exported as a const so it survives any bundler
// (Next.js / webpack do NOT bundle .sql assets; readFileSync(new URL(...)) breaks at runtime).
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS suites (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
  target_config TEXT NOT NULL, judge_config TEXT, run_config TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, source TEXT NOT NULL,
  gen_spec TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL, vars TEXT NOT NULL, expected TEXT);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, suite_id TEXT NOT NULL, dataset_id TEXT NOT NULL,
  status TEXT NOT NULL, n_repeats INTEGER NOT NULL, started_at INTEGER, finished_at INTEGER, error TEXT);
CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL, test_case_id TEXT NOT NULL, repeat_index INTEGER NOT NULL,
  status TEXT NOT NULL, output_text TEXT, tool_calls TEXT, judge_verdict TEXT, metrics TEXT,
  usage TEXT, error TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_results_run ON results(run_id);
CREATE INDEX IF NOT EXISTS idx_cases_dataset ON test_cases(dataset_id);
`;
