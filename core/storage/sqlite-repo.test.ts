import Database from 'better-sqlite3';
import { SQLiteRepo } from './sqlite-repo';
import type { Suite } from '../types';

function repo() { return new SQLiteRepo(new Database(':memory:')); }
const suite: Suite = { id: 's1', ownerId: 'local', name: 'note-namer', type: 'behavior',
  target: { model: 'openai/gpt-4o-mini', systemPrompt: 'sys', userPromptTemplate: '{{article}}' },
  judge: { enabled: true, model: 'openai/gpt-4o-mini', rubric: 'concise?' },
  runConfig: { nRepeats: 3 }, createdAt: 1 };

test('createSuite + getSuite round-trips nested config', () => {
  const r = repo();
  r.createSuite(suite);
  expect(r.getSuite('s1')).toEqual(suite);
});
test('listSuites filters by owner', () => {
  const r = repo();
  r.createSuite(suite);
  r.createSuite({ ...suite, id: 's2', ownerId: 'other' });
  expect(r.listSuites('local').map(s => s.id)).toEqual(['s1']);
});
test('getSuite returns null when absent', () => {
  expect(repo().getSuite('nope')).toBeNull();
});

test('createDataset + listTestCases round-trips vars + expected', () => {
  const r = repo();
  r.createDataset(
    { id: 'd1', ownerId: 'local', name: 'ds', source: 'generated',
      genSpec: { languages: ['en'], countPerLang: 1, lengthWords: 50, topic: 'x' }, createdAt: 1 },
    [{ id: 'c1', datasetId: 'd1', vars: { article: 'hi' }, expected: { tool: 'get_weather' } }]);
  expect(r.getDataset('d1')?.genSpec?.topic).toBe('x');
  const cases = r.listTestCases('d1');
  expect(cases).toHaveLength(1);
  expect(cases[0]?.expected?.tool).toBe('get_weather');
});

test('insertResult + listResults preserves toolCalls + usage', () => {
  const r = repo();
  r.createRun({ id: 'run1', ownerId: 'local', suiteId: 's1', datasetId: 'd1',
    status: 'running', nRepeats: 2, startedAt: 1, finishedAt: null, error: null });
  r.insertResult({ id: 'res1', runId: 'run1', testCaseId: 'c1', repeatIndex: 0, status: 'ok',
    toolCalls: [{ name: 'get_weather', argumentsRaw: '{"q":"x"}' }],
    usage: { promptTokens: 10, completionTokens: 2 }, createdAt: 1 });
  const got = r.listResults('run1');
  expect(got[0]?.toolCalls?.[0]?.name).toBe('get_weather');
  expect(got[0]?.usage).toEqual({ promptTokens: 10, completionTokens: 2 });
});
