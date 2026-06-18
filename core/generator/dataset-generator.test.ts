import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import { OpenRouterClient } from '../runner/openrouter-client';
import { DatasetGenerator, DatasetGeneratorError } from './dataset-generator';

const URL = 'https://openrouter.ai/api/v1/chat/completions';
const client = new OpenRouterClient({ apiKey: 'k', maxRetries: 0, baseDelayMs: 1 });
const generator = new DatasetGenerator(client);

test('generates countPerLang cases per language', async () => {
  server.use(http.post(URL, async ({ request }) => {
    const body = await request.json() as { messages: Array<{ content: string }> };
    const lang = body.messages.at(-1)?.content.match(/LANG=(\w+)/)?.[1];
    return HttpResponse.json({ choices: [{ message: { content: JSON.stringify({
      cases: [{ input: `${lang}-1` }, { input: `${lang}-2` }] }) }, finish_reason: 'stop' }], usage: {} });
  }));
  const cases = await generator.generate(
    { languages: ['en','ja'], countPerLang: 2, lengthWords: 50, topic: 'World Cup' }, 'dataset-1');
  expect(cases).toHaveLength(4);
  expect(cases.every(c => c.datasetId === 'dataset-1')).toBe(true);
  // each language was actually called with its own LANG marker (mock echoes lang into input)
  const inputs = cases.map((c) => c.vars.input);
  expect(inputs).toEqual(['en-1', 'en-2', 'ja-1', 'ja-2']);
});

test('throws named error when response content is not JSON', async () => {
  server.use(http.post(URL, () => HttpResponse.json({
    choices: [{ message: { content: 'not json' }, finish_reason: 'stop' }], usage: {} })));
  await expect(generator.generate(
    { languages: ['en'], countPerLang: 1, lengthWords: 50, topic: 'x' }, 'dataset-1'),
  ).rejects.toBeInstanceOf(DatasetGeneratorError);
});

test('throws named error when response has no cases array', async () => {
  server.use(http.post(URL, () => HttpResponse.json({
    choices: [{ message: { content: JSON.stringify({ wrong: true }) }, finish_reason: 'stop' }], usage: {} })));
  await expect(generator.generate(
    { languages: ['en'], countPerLang: 1, lengthWords: 50, topic: 'x' }, 'dataset-1'),
  ).rejects.toBeInstanceOf(DatasetGeneratorError);
});

test('throws named error when language returns fewer cases than requested', async () => {
  server.use(http.post(URL, () => HttpResponse.json({
    choices: [{ message: { content: JSON.stringify({ cases: [{ input: 'only-one' }] }) },
      finish_reason: 'stop' }], usage: {} })));
  await expect(generator.generate(
    { languages: ['en'], countPerLang: 2, lengthWords: 50, topic: 'x' }, 'dataset-1'),
  ).rejects.toBeInstanceOf(DatasetGeneratorError);
});
