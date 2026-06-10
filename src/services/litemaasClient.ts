import type { LiteMaaSSettings } from '@/utils/litemaasSettings';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

export class LiteMaaSClientError extends Error {
  readonly isLikelyCors: boolean;

  constructor(message: string, isLikelyCors = false) {
    super(message);
    this.name = 'LiteMaaSClientError';
    this.isLikelyCors = isLikelyCors;
  }
}

function completionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
}

export async function chatCompletion(
  settings: LiteMaaSSettings,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const baseUrl = settings.baseUrl.trim().replace(/\/+$/, '');
  const apiKey = settings.apiKey.trim();
  const model = settings.model.trim();

  if (!baseUrl || !apiKey) {
    throw new LiteMaaSClientError('LiteMaaS API key and base URL are required. Add them in Settings.');
  }

  let response: Response;
  try {
    response = await fetch(completionsUrl(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options?.maxTokens ?? 1200,
        temperature: options?.temperature ?? 0.4,
      }),
    });
  } catch {
    throw new LiteMaaSClientError(
      'Network request failed. If the LiteLLM endpoint blocks browser calls (CORS), you may need a small proxy server.',
      true,
    );
  }

  let body: ChatCompletionResponse;
  try {
    body = (await response.json()) as ChatCompletionResponse;
  } catch {
    throw new LiteMaaSClientError(`Unexpected response from LiteLLM (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const msg = body.error?.message ?? `LiteLLM request failed (HTTP ${response.status}).`;
    throw new LiteMaaSClientError(msg);
  }

  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new LiteMaaSClientError('LiteLLM returned an empty response.');
  }
  return content;
}

export async function testLiteMaaSConnection(settings: LiteMaaSSettings): Promise<string> {
  return chatCompletion(
    settings,
    [
      { role: 'user', content: 'Reply with exactly: connected' },
    ],
    { maxTokens: 16, temperature: 0 },
  );
}
