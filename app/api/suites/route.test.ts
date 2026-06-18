import { beforeEach, afterEach, describe, test, expect } from 'vitest';
import { createContainer, setContainer, resetContainer } from '@app/lib/container';
import { GET, POST } from './route';
import { GET as GETById, PUT, DELETE } from './[id]/route';

beforeEach(() => {
  setContainer(createContainer({ dbPath: ':memory:' }));
});
afterEach(() => {
  resetContainer();
});

const validSuite = {
  name: 'Test Suite',
  type: 'behavior' as const,
  target: {
    model: 'openai/gpt-4o-mini',
    systemPrompt: 'You are a helpful assistant.',
    userPromptTemplate: '{{article}}',
  },
  judge: {
    enabled: true,
    model: 'openai/gpt-4o-mini',
    rubric: 'Score on relevance 1-10',
  },
  runConfig: { nRepeats: 1 },
};

describe('GET /api/suites', () => {
  test('returns empty array when no suites', async () => {
    const res = await GET(new Request('http://localhost/api/suites'));
    expect(res.status).toBe(200);
    const data = await res.json() as unknown[];
    expect(data).toEqual([]);
  });

  test('returns created suites', async () => {
    await POST(new Request('http://localhost/api/suites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSuite),
    }));

    const res = await GET(new Request('http://localhost/api/suites'));
    const data = await res.json() as unknown[];
    expect(data).toHaveLength(1);
    expect((data[0] as { name: string }).name).toBe('Test Suite');
  });
});

describe('POST /api/suites', () => {
  test('creates suite and returns 201', async () => {
    const req = new Request('http://localhost/api/suites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSuite),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json() as { id: string; name: string; ownerId: string };
    expect(data.name).toBe('Test Suite');
    expect(data.ownerId).toBe('local');
    expect(typeof data.id).toBe('string');
  });

  test('returns 400 for invalid type', async () => {
    const req = new Request('http://localhost/api/suites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validSuite, type: 'invalid_type' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBeTruthy();
  });

  test('returns 400 for missing name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _name, ...noName } = validSuite;
    const req = new Request('http://localhost/api/suites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noName),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/suites/[id]', () => {
  test('returns suite by id', async () => {
    const createRes = await POST(new Request('http://localhost/api/suites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSuite),
    }));
    const created = await createRes.json() as { id: string };

    const res = await GETById(
      new Request(`http://localhost/api/suites/${created.id}`),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json() as { id: string };
    expect(data.id).toBe(created.id);
  });

  test('returns 404 for non-existent id', async () => {
    const res = await GETById(
      new Request('http://localhost/api/suites/nonexistent'),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/suites/[id]', () => {
  test('updates suite name', async () => {
    const createRes = await POST(new Request('http://localhost/api/suites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSuite),
    }));
    const created = await createRes.json() as { id: string };

    const res = await PUT(
      new Request(`http://localhost/api/suites/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json() as { name: string };
    expect(data.name).toBe('Updated Name');
  });
});

describe('DELETE /api/suites/[id]', () => {
  test('deletes suite', async () => {
    const createRes = await POST(new Request('http://localhost/api/suites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSuite),
    }));
    const created = await createRes.json() as { id: string };

    const deleteRes = await DELETE(
      new Request(`http://localhost/api/suites/${created.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(deleteRes.status).toBe(204);

    const getRes = await GETById(
      new Request(`http://localhost/api/suites/${created.id}`),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(getRes.status).toBe(404);
  });
});
