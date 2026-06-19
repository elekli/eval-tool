import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import { OpenRouterClient } from '../runner/openrouter-client';
import { Judge, JudgeParseError } from './judge';
import type { JudgeConfig } from '../types';

const URL = 'https://openrouter.ai/api/v1/chat/completions';

const client = new OpenRouterClient({ apiKey: 'k', maxRetries: 0, baseDelayMs: 1 });
const judge = new Judge(client);

const cfg: JudgeConfig = { enabled: true, model: 'judge-model', rubric: '標題簡潔嗎' };
const payload = { input: { article: '...' }, output: '世足標題' };

test('judge returns score + reasoning from structured output', async () => {
  server.use(
    http.post(URL, () =>
      HttpResponse.json({
        choices: [
          {
            message: {
              content: JSON.stringify({ score: 4, reasoning: '簡潔且同語言' }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.001 },
      }),
    ),
  );
  const result = await judge.evaluate(cfg, payload);
  expect(result.verdict).toEqual({ score: 4, reasoning: '簡潔且同語言' });
  expect(result.usage.promptTokens).toBe(10);
  expect(result.usage.completionTokens).toBe(5);
  expect(result.usage.costUsd).toBeCloseTo(0.001);
});

test('judge throws named error on unparseable output', async () => {
  server.use(
    http.post(URL, () =>
      HttpResponse.json({
        choices: [{ message: { content: 'not json' }, finish_reason: 'stop' }],
        usage: {},
      }),
    ),
  );
  await expect(judge.evaluate(cfg, payload)).rejects.toThrowError(/JudgeParseError/);
});

test('JudgeParseError has distinct name property', async () => {
  server.use(
    http.post(URL, () =>
      HttpResponse.json({
        choices: [{ message: { content: '{ "score": "not-a-number", "reasoning": "x" }' }, finish_reason: 'stop' }],
        usage: {},
      }),
    ),
  );
  await expect(judge.evaluate(cfg, payload)).rejects.toBeInstanceOf(JudgeParseError);
});
