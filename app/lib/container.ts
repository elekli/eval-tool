import BetterSqlite3 from 'better-sqlite3';
import { SQLiteRepo } from '@core/storage/sqlite-repo';
import { OpenRouterClient } from '@core/runner/openrouter-client';
import { OpenRouterRunner } from '@core/runner/openrouter-runner';
import { Judge } from '@core/judge/judge';
import { DatasetGenerator } from '@core/generator/dataset-generator';
import type { Repository } from '@core/storage/repository';
import type { Runner } from '@core/runner/runner';

export const LOCAL_OWNER = 'local';

export interface Container {
  repo: Repository;
  runner: Runner;
  judge: Judge;
  generator: DatasetGenerator;
}

export interface ContainerOverrides {
  dbPath?: string;
}

export function createContainer(overrides?: ContainerOverrides): Container {
  const dbPath = overrides?.dbPath ?? process.env.EVAL_DB_PATH ?? './eval.db';
  const db = new BetterSqlite3(dbPath);
  const repo = new SQLiteRepo(db);

  const apiKey = process.env.OPENROUTER_API_KEY ?? '';
  const client = new OpenRouterClient({ apiKey });
  const runner = new OpenRouterRunner(client);
  const judge = new Judge(client);
  const generator = new DatasetGenerator(client);

  return { repo, runner, judge, generator };
}

let current: Container | null = null;

export function getContainer(): Container {
  if (!current) {
    current = createContainer();
  }
  return current;
}

export function setContainer(c: Container): void {
  current = c;
}

export function resetContainer(): void {
  current = null;
}
