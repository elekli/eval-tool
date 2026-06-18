import type { GenSpec, TestCase } from '../types';
import type { OpenRouterClient } from '../runner/openrouter-client';

interface GeneratedCase {
  article: string;
  [key: string]: string;
}

interface GeneratedCasesResponse {
  cases: GeneratedCase[];
}

export class DatasetGenerator {
  private client: OpenRouterClient;

  constructor(client: OpenRouterClient) {
    this.client = client;
  }

  async generate(genSpec: GenSpec, datasetId: string): Promise<TestCase[]> {
    const { languages, countPerLang, lengthWords, topic, extra } = genSpec;

    const allCases: TestCase[] = [];

    for (const lang of languages) {
      const prompt = [
        `Generate ${countPerLang} test cases for the following task.`,
        `LANG=${lang}`,
        `Topic: ${topic}`,
        `Each article should be approximately ${lengthWords} words.`,
        extra ? `Additional instructions: ${extra}` : null,
        `Return a JSON object with a "cases" array, each element having an "article" field.`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await this.client.chat({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'generated_cases',
            schema: {
              type: 'object',
              required: ['cases'],
              properties: {
                cases: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['article'],
                    properties: {
                      article: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as GeneratedCasesResponse;

      for (const caseObj of parsed.cases) {
        allCases.push({
          id: crypto.randomUUID(),
          datasetId,
          vars: { ...caseObj },
        });
      }
    }

    return allCases;
  }
}
