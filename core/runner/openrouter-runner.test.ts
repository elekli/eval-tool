import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import { OpenRouterClient } from './openrouter-client';
import { OpenRouterRunner } from './openrouter-runner';

const URL = 'https://openrouter.ai/api/v1/chat/completions';
const client = new OpenRouterClient({ apiKey: 'k', maxRetries: 0, baseDelayMs: 1 });
const runner = new OpenRouterRunner(client);

// behaviour
test('behaviour run interpolates vars and returns text', async () => {
  server.use(http.post(URL, async ({ request }) => {
    const body = await request.json() as { messages: Array<{ content: string }> };
    expect(body.messages.at(-1)?.content).toContain('世足');     // interpolated
    return HttpResponse.json({ choices: [{ message: { content: '標題' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 1 } });
  }));
  const rec = await runner.run(
    { model: 'm', systemPrompt: 's', userPromptTemplate: '{{article}}' },
    { id: 'c', datasetId: 'd', vars: { article: '談世足' } });
  expect(rec.text).toBe('標題');
  expect(rec.usage?.promptTokens).toBe(3);
});

// tool_use
test('tool_use run extracts tool name + parsed args', async () => {
  server.use(http.post(URL, () => HttpResponse.json({
    choices: [{ finish_reason: 'tool_calls',
      message: { tool_calls: [{ function: { name: 'get_weather', arguments: '{"loc":"TP"}' } }] } }],
    usage: {} })));
  const rec = await runner.run(
    { model: 'm', systemPrompt: 's', userPromptTemplate: 'weather?', tools: [
      { name: 'get_weather', description: 'd', parameters: { type: 'object', properties: { loc: { type: 'string' } } } }] },
    { id: 'c', datasetId: 'd', vars: {} });
  expect(rec.toolCalls?.[0]).toMatchObject({ name: 'get_weather', argumentsParsed: { loc: 'TP' } });
});

test('tool_use run always sets argumentsRaw', async () => {
  server.use(http.post(URL, () => HttpResponse.json({
    choices: [{ finish_reason: 'tool_calls',
      message: { tool_calls: [{ function: { name: 'search', arguments: 'not-json' } }] } }],
    usage: {} })));
  const rec = await runner.run(
    { model: 'm', systemPrompt: 's', userPromptTemplate: 'search?', tools: [
      { name: 'search', description: 'd', parameters: {} }] },
    { id: 'c', datasetId: 'd', vars: {} });
  expect(rec.toolCalls?.[0]?.argumentsRaw).toBe('not-json');
  expect(rec.toolCalls?.[0]?.argumentsParsed).toBeUndefined();
});

test('usage defaults absent tokens to 0', async () => {
  server.use(http.post(URL, () => HttpResponse.json({
    choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }],
    usage: {} })));
  const rec = await runner.run(
    { model: 'm', systemPrompt: 's', userPromptTemplate: 'hello' },
    { id: 'c', datasetId: 'd', vars: {} });
  expect(rec.usage?.promptTokens).toBe(0);
  expect(rec.usage?.completionTokens).toBe(0);
  expect(Number.isNaN(rec.usage?.promptTokens)).toBe(false);
});

test('usage maps costUsd from usage.cost when present', async () => {
  server.use(http.post(URL, () => HttpResponse.json({
    choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0.0005 } })));
  const rec = await runner.run(
    { model: 'm', systemPrompt: 's', userPromptTemplate: 'hello' },
    { id: 'c', datasetId: 'd', vars: {} });
  expect(rec.usage?.costUsd).toBeCloseTo(0.0005);
});
