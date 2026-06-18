import type { OpenRouterClient } from '../runner/openrouter-client';
import type { JudgeConfig, JudgeVerdict } from '../types';

export class JudgeParseError extends Error {
  name = 'JudgeParseError' as const;
  constructor(message: string) {
    // Prefix the class name into the message so .toThrowError(/JudgeParseError/) matches.
    super(`JudgeParseError: ${message}`);
    this.name = 'JudgeParseError';
  }
}

export class Judge {
  private client: OpenRouterClient;

  constructor(client: OpenRouterClient) {
    this.client = client;
  }

  async evaluate(
    judgeConfig: JudgeConfig,
    payload: { input: Record<string, unknown>; output: string },
  ): Promise<JudgeVerdict> {
    const prompt = [
      'You are an impartial evaluator. Given the rubric below, score the model output.',
      '',
      `RUBRIC: ${judgeConfig.rubric}`,
      '',
      `INPUT: ${JSON.stringify(payload.input)}`,
      '',
      `OUTPUT: ${payload.output}`,
      '',
      'Return a JSON object with fields: score (number) and reasoning (string).',
    ].join('\n');

    const response = await this.client.chat({
      model: judgeConfig.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'verdict',
          schema: {
            type: 'object',
            required: ['score', 'reasoning'],
            properties: {
              score: { type: 'number' },
              reasoning: { type: 'string' },
            },
          },
        },
      },
    });

    const raw = response.choices[0]?.message?.content;

    if (!raw) {
      throw new JudgeParseError('response had no content');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new JudgeParseError(`response is not valid JSON: ${raw}`);
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).score !== 'number' ||
      typeof (parsed as Record<string, unknown>).reasoning !== 'string'
    ) {
      throw new JudgeParseError(
        `response failed schema validation: ${raw}`,
      );
    }

    const { score, reasoning } = parsed as { score: number; reasoning: string };
    return { score, reasoning };
  }
}
