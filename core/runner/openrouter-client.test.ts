import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import { OpenRouterClient, RetryableError, NonRetryableError } from './openrouter-client';

const URL = 'https://openrouter.ai/api/v1/chat/completions';
const client = new OpenRouterClient({ apiKey: 'k', maxRetries: 2, baseDelayMs: 1 });

test('returns choice on 200', async () => {
  server.use(http.post(URL, () => HttpResponse.json({
    choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 5, completion_tokens: 1 } })));
  const res = await client.chat({ model: 'm', messages: [{ role: 'user', content: 'x' }] });
  expect(res.choices[0].message.content).toBe('hi');
});

test('retries on 429 then succeeds', async () => {
  let n = 0;
  server.use(http.post(URL, () => {
    n++; return n < 2 ? new HttpResponse(null, { status: 429 })
      : HttpResponse.json({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: {} });
  }));
  const res = await client.chat({ model: 'm', messages: [] });
  expect(res.choices[0].message.content).toBe('ok');
  expect(n).toBe(2);
});

test('throws NonRetryableError on 400 without retry', async () => {
  let n = 0;
  server.use(http.post(URL, () => { n++; return new HttpResponse(null, { status: 400 }); }));
  await expect(client.chat({ model: 'm', messages: [] })).rejects.toBeInstanceOf(NonRetryableError);
  expect(n).toBe(1);
});

test('sends Authorization: Bearer <apiKey>', async () => {
  let auth: string | null = null;
  server.use(http.post(URL, ({ request }) => { auth = request.headers.get('authorization');
    return HttpResponse.json({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: {} }); }));
  await client.chat({ model: 'm', messages: [] });
  expect(auth).toBe('Bearer k');
});

test('retries on 500 then throws RetryableError after maxRetries', async () => {
  let n = 0;
  server.use(http.post(URL, () => { n++; return new HttpResponse(null, { status: 500 }); }));
  await expect(client.chat({ model: 'm', messages: [] })).rejects.toBeInstanceOf(RetryableError);
  expect(n).toBe(3);   // 1 initial + maxRetries(2)
});

test('retries on network error', async () => {
  let n = 0;
  server.use(http.post(URL, () => { n++; return n < 2 ? HttpResponse.error()
    : HttpResponse.json({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: {} }); }));
  const res = await client.chat({ model: 'm', messages: [] });
  expect(res.choices[0].message.content).toBe('ok');
});
