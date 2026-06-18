import { beforeEach, afterEach, describe, test, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/setup';
import { createContainer, setContainer, resetContainer } from '@app/lib/container';
import { POST as POSTRun } from './route';
import { GET as GETRun } from './[id]/route';
import { GET as GETSummary } from './[id]/summary/route';
import { POST as POSTSuite } from '../suites/route';
import { POST as POSTDataset } from '../datasets/route';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Default mock: text response for behavior runs
function mockOpenRouterText(text = 'test output') {
  server.use(
    http.post(OPENROUTER_URL, () =>
      HttpResponse.json({
        choices: [{ message: { content: text }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 3, cost: 0.0001 },
      }),
    ),
  );
}

beforeEach(() => {
  setContainer(createContainer({ dbPath: ':memory:' }));
  process.env.EVAL_SYNC_RUN = '1';
});

afterEach(() => {
  resetContainer();
  delete process.env.EVAL_SYNC_RUN;
});

async function createSuite() {
  const res = await POSTSuite(
    new Request('http://localhost/api/suites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Suite',
        type: 'behavior',
        target: {
          model: 'openai/gpt-4o-mini',
          systemPrompt: 'Summarize the article.',
          userPromptTemplate: '{{article}}',
        },
        judge: null,
        runConfig: { nRepeats: 1 },
      }),
    }),
  );
  return res.json() as Promise<{ id: string }>;
}

async function createDataset() {
  const res = await POSTDataset(
    new Request('http://localhost/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Dataset',
        source: 'manual',
        cases: [
          { vars: { article: 'Hello world article text.' } },
          { vars: { article: 'Another article for testing.' } },
        ],
      }),
    }),
  );
  return res.json() as Promise<{ dataset: { id: string } }>;
}

describe('POST /api/runs', () => {
  test('creates run and returns 202 with id (EVAL_SYNC_RUN=1)', async () => {
    mockOpenRouterText();
    const { id: suiteId } = await createSuite();
    const { dataset } = await createDataset();

    const res = await POSTRun(
      new Request('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId, datasetId: dataset.id }),
      }),
    );
    expect(res.status).toBe(202);
    const data = await res.json() as { id: string };
    expect(typeof data.id).toBe('string');
  });

  test('run results are populated after EVAL_SYNC_RUN=1 completes', async () => {
    mockOpenRouterText('summary text');
    const { id: suiteId } = await createSuite();
    const { dataset } = await createDataset();

    const res = await POSTRun(
      new Request('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId, datasetId: dataset.id }),
      }),
    );
    const { id: runId } = await res.json() as { id: string };

    const runRes = await GETRun(
      new Request(`http://localhost/api/runs/${runId}`),
      { params: Promise.resolve({ id: runId }) },
    );
    expect(runRes.status).toBe(200);
    const runData = await runRes.json() as { run: { status: string }; results: unknown[] };
    expect(runData.run.status).toBe('done');
    expect(runData.results.length).toBeGreaterThan(0);
  });

  test('returns 400 for missing suiteId', async () => {
    const res = await POSTRun(
      new Request('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId: 'some-id' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  test('returns 400 for non-existent suite', async () => {
    const { dataset } = await createDataset();
    const res = await POSTRun(
      new Request('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId: 'nonexistent', datasetId: dataset.id }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/runs/[id]', () => {
  test('returns run and results', async () => {
    mockOpenRouterText();
    const { id: suiteId } = await createSuite();
    const { dataset } = await createDataset();

    const postRes = await POSTRun(
      new Request('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId, datasetId: dataset.id }),
      }),
    );
    const { id: runId } = await postRes.json() as { id: string };

    const res = await GETRun(
      new Request(`http://localhost/api/runs/${runId}`),
      { params: Promise.resolve({ id: runId }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json() as { run: { id: string }; results: unknown[]; cases: unknown[] };
    expect(data.run.id).toBe(runId);
    expect(Array.isArray(data.results)).toBe(true);
    expect(Array.isArray(data.cases)).toBe(true);
    expect(data.cases.length).toBeGreaterThan(0);
  });

  test('returns 404 for non-existent run', async () => {
    const res = await GETRun(
      new Request('http://localhost/api/runs/nonexistent'),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  test('response includes cases from the dataset', async () => {
    mockOpenRouterText();
    const { id: suiteId } = await createSuite();
    const { dataset } = await createDataset();

    const postRes = await POSTRun(
      new Request('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId, datasetId: dataset.id }),
      }),
    );
    const { id: runId } = await postRes.json() as { id: string };

    const res = await GETRun(
      new Request(`http://localhost/api/runs/${runId}`),
      { params: Promise.resolve({ id: runId }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json() as { run: { id: string }; results: unknown[]; cases: Array<{ id: string; vars: Record<string, unknown> }> };
    expect(Array.isArray(data.cases)).toBe(true);
    // Dataset was created with 2 cases
    expect(data.cases.length).toBe(2);
    // Each case should carry vars
    for (const c of data.cases) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.vars).toBe('object');
    }
  });
});

describe('GET /api/runs/[id]/summary', () => {
  test('returns summary with cases', async () => {
    mockOpenRouterText();
    const { id: suiteId } = await createSuite();
    const { dataset } = await createDataset();

    const postRes = await POSTRun(
      new Request('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId, datasetId: dataset.id }),
      }),
    );
    const { id: runId } = await postRes.json() as { id: string };

    const res = await GETSummary(
      new Request(`http://localhost/api/runs/${runId}/summary`),
      { params: Promise.resolve({ id: runId }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json() as { cases: unknown[]; type: string };
    expect(Array.isArray(data.cases)).toBe(true);
    expect(data.cases.length).toBeGreaterThan(0);
    expect(data.type).toBe('behavior');
  });
});
