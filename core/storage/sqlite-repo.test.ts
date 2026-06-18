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

test('listDatasets filters by owner', () => {
  const r = repo();
  r.createDataset(
    { id: 'd-local', ownerId: 'local', name: 'mine', source: 'manual', createdAt: 1 },
    []
  );
  r.createDataset(
    { id: 'd-other', ownerId: 'other', name: 'theirs', source: 'manual', createdAt: 2 },
    []
  );
  expect(r.listDatasets('local').map(d => d.id)).toEqual(['d-local']);
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

// Fix 3: absent optional fields on Result should round-trip as undefined, not null/"null"
test('minimal error result: absent optional fields come back undefined', () => {
  const r = repo();
  r.createRun({ id: 'run2', ownerId: 'local', suiteId: 's1', datasetId: 'd1',
    status: 'running', nRepeats: 1, startedAt: 1, finishedAt: null, error: null });
  // Insert a minimal result: only required fields + error; no outputText/toolCalls/usage/judgeVerdict/metrics
  r.insertResult({
    id: 'res2', runId: 'run2', testCaseId: 'c1', repeatIndex: 0,
    status: 'error', error: 'timeout', createdAt: 2,
  });
  const got = r.listResults('run2');
  expect(got).toHaveLength(1);
  const res = got[0]!;
  // required fields preserved
  expect(res.status).toBe('error');
  expect(res.error).toBe('timeout');
  // optional absent fields → undefined (NOT null or the string "null")
  expect(res.outputText).toBeUndefined();
  expect(res.toolCalls).toBeUndefined();
  expect(res.usage).toBeUndefined();
  expect(res.judgeVerdict).toBeUndefined();
  expect(res.metrics).toBeUndefined();
});

// Fix 3: Dataset without genSpec round-trips with genSpec undefined
test('dataset without genSpec round-trips genSpec as undefined', () => {
  const r = repo();
  r.createDataset(
    { id: 'd2', ownerId: 'local', name: 'manual-ds', source: 'manual', createdAt: 5 },
    []
  );
  const ds = r.getDataset('d2');
  expect(ds).not.toBeNull();
  expect(ds?.genSpec).toBeUndefined();
});

// Fix 3: Suite with judge: null still round-trips correctly
test('suite with judge null round-trips judge as null', () => {
  const r = repo();
  const noJudge: Suite = { ...suite, id: 's-nojudge', judge: null };
  r.createSuite(noJudge);
  expect(r.getSuite('s-nojudge')?.judge).toBeNull();
});
