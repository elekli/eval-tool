import type { TargetConfig, TestCase, ToolCall, Usage } from '../types';
import type { OpenRouterClient } from './openrouter-client';
import type { ExecutionRecord, Runner } from './runner';
import { renderTemplate } from './template';

export class OpenRouterRunner implements Runner {
  constructor(private client: OpenRouterClient) {}

  async run(target: TargetConfig, testCase: TestCase): Promise<ExecutionRecord> {
    const userContent = renderTemplate(target.userPromptTemplate, testCase.vars);

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: target.systemPrompt },
      { role: 'user', content: userContent },
    ];

    const requestBody: Parameters<OpenRouterClient['chat']>[0] = {
      model: target.model,
      messages,
    };

    if (target.temperature !== undefined) {
      requestBody.temperature = target.temperature;
    }

    if (target.tools && target.tools.length > 0) {
      requestBody.tools = target.tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      requestBody.tool_choice = 'auto';
    }

    const response = await this.client.chat(requestBody);
    const choice = response.choices[0];
    const message = choice?.message;

    // Extract text
    const text = message?.content ?? undefined;

    // Extract tool calls with defensive parse
    let toolCalls: ToolCall[] | undefined;
    if (message?.tool_calls && message.tool_calls.length > 0) {
      toolCalls = message.tool_calls.map((tc) => {
        const argumentsRaw = tc.function.arguments;
        let argumentsParsed: unknown | undefined;
        try {
          argumentsParsed = JSON.parse(argumentsRaw);
        } catch {
          // leave undefined — spec §11.4 defensive parse
        }
        return { name: tc.function.name, argumentsRaw, argumentsParsed };
      });
    }

    // Map usage snake_case → camelCase, default absent tokens to 0
    const rawUsage = response.usage;
    const usage: Usage = {
      promptTokens: rawUsage?.prompt_tokens ?? 0,
      completionTokens: rawUsage?.completion_tokens ?? 0,
      ...(rawUsage?.cost !== undefined ? { costUsd: rawUsage.cost } : {}),
    };

    const record: ExecutionRecord = {
      usage,
      raw: response,
    };

    if (text !== undefined) {
      record.text = text;
    }
    if (toolCalls !== undefined) {
      record.toolCalls = toolCalls;
    }

    return record;
  }
}
