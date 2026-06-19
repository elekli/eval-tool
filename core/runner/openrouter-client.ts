export class RetryableError extends Error {
  name = 'RetryableError' as const;
  constructor(message: string) {
    super(message);
  }
}

export class NonRetryableError extends Error {
  name = 'NonRetryableError' as const;
  constructor(message: string) {
    super(message);
  }
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  tools?: unknown[];
  tool_choice?: string;
  response_format?: unknown;
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content?: string;
      tool_calls?: Array<{
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
  };
}

export interface OpenRouterClientOptions {
  apiKey: string;
  maxRetries?: number;
  baseDelayMs?: number;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenRouterClient {
  private apiKey: string;
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(options: OpenRouterClientOptions) {
    this.apiKey = options.apiKey;
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 500;
  }

  async chat(request: ChatRequest): Promise<OpenRouterResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        await delay(this.baseDelayMs * Math.pow(2, attempt - 1));
      }

      try {
        const response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (response.ok) {
          return (await response.json()) as OpenRouterResponse;
        }

        if (isRetryableStatus(response.status)) {
          lastError = new RetryableError(`HTTP ${response.status}`);
          // continue to retry
        } else {
          // non-retryable 4xx
          throw new NonRetryableError(`HTTP ${response.status}`);
        }
      } catch (err) {
        if (err instanceof NonRetryableError) {
          throw err;
        }
        if (err instanceof RetryableError) {
          lastError = err;
          // continue to retry
        } else {
          // network / fetch error — retryable
          lastError = new RetryableError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    throw lastError ?? new RetryableError('Unknown error after retries');
  }
}
