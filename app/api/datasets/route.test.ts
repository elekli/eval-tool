import { beforeEach, afterEach, describe, test, expect } from 'vitest';
import { createContainer, setContainer, resetContainer } from '@app/lib/container';
import { GET, POST } from './route';

beforeEach(() => {
  setContainer(createContainer({ dbPath: ':memory:' }));
});
afterEach(() => {
  resetContainer();
});

const validDataset = {
  name: 'Test Dataset',
  source: 'manual' as const,
  cases: [
    { vars: { article: 'Hello world.' } },
    { vars: { article: 'Another article.' } },
  ],
};

describe('GET /api/datasets', () => {
  test('returns empty array when no datasets', async () => {
    const res = await GET(new Request('http://localhost/api/datasets'));
    expect(res.status).toBe(200);
    const data = await res.json() as unknown[];
    expect(data).toEqual([]);
  });

  test('returns only datasets belonging to local owner', async () => {
    // Create a dataset via POST (uses LOCAL_OWNER internally)
    await POST(new Request('http://localhost/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validDataset),
    }));

    const res = await GET(new Request('http://localhost/api/datasets'));
    expect(res.status).toBe(200);
    const data = await res.json() as unknown[];
    expect(data).toHaveLength(1);
    expect((data[0] as { name: string }).name).toBe('Test Dataset');
  });
});

describe('POST /api/datasets', () => {
  test('creates dataset with cases and returns 201', async () => {
    const req = new Request('http://localhost/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validDataset),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json() as { dataset: { id: string; name: string; ownerId: string }; cases: unknown[] };
    expect(data.dataset.name).toBe('Test Dataset');
    expect(data.dataset.ownerId).toBe('local');
    expect(typeof data.dataset.id).toBe('string');
    expect(data.cases).toHaveLength(2);
  });

  test('returns 400 for invalid source', async () => {
    const req = new Request('http://localhost/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validDataset, source: 'invalid_source' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBeTruthy();
  });

  test('returns 400 for missing name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _name, ...noName } = validDataset;
    const req = new Request('http://localhost/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noName),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test('creates dataset with genSpec', async () => {
    const withGenSpec = {
      name: 'Generated Dataset',
      source: 'generated' as const,
      genSpec: {
        languages: ['en', 'zh'],
        countPerLang: 5,
        lengthWords: 100,
        topic: 'sports',
      },
      cases: [],
    };
    const req = new Request('http://localhost/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withGenSpec),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json() as { dataset: { name: string } };
    expect(data.dataset.name).toBe('Generated Dataset');
  });
});
