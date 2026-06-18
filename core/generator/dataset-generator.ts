import type { GenSpec, TestCase } from '../types';
import type { OpenRouterClient } from '../runner/openrouter-client';

interface GeneratedCase {
  input: string;
  [key: string]: string;
}

interface GeneratedCasesResponse {
  cases: GeneratedCase[];
}

/** Raised when a language's generation response can't be parsed or has the wrong shape. */
export class DatasetGeneratorError extends Error {
  name = 'DatasetGeneratorError' as const;
  constructor(message: string) {
    super(message);
  }
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
        `Return a JSON object with a "cases" array, each element having an "input" field holding the content.`,
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
                    required: ['input'],
                    properties: {
                      input: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (content == null || content === '') {
        throw new DatasetGeneratorError(
          `Empty generation response for LANG=${lang} (model returned no content; possibly refused or content-filtered)`,
        );
      }

      let parsed: GeneratedCasesResponse;
      try {
        parsed = JSON.parse(content) as GeneratedCasesResponse;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new DatasetGeneratorError(
          `Failed to parse generation response for LANG=${lang}: ${reason}. Raw content: ${content.slice(0, 200)}`,
        );
      }

      if (!Array.isArray(parsed.cases)) {
        throw new DatasetGeneratorError(
          `Generation response for LANG=${lang} has no "cases" array (got ${typeof parsed.cases})`,
        );
      }

      if (parsed.cases.length !== countPerLang) {
        throw new DatasetGeneratorError(
          `Generation for LANG=${lang} returned ${parsed.cases.length} cases, expected ${countPerLang}`,
        );
      }

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
