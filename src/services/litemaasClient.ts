import type { LiteMaaSSettings } from '@/utils/litemaasSettings';
import {
  liteLLMProxyUrl,
  normalizeLiteLLMBaseUrl,
  shouldUseLiteLLMProxy,
} from '@/utils/litellmUrl';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatMessagePart = { type?: string; text?: string };

type ChatCompletionChoice = {
  message?: {
    content?: string | ChatMessagePart[] | null;
    reasoning_content?: string | null;
    reasoning?: string | null;
  };
  finish_reason?: string | null;
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
  error?: { message?: string };
};

export type AssistantMessageTexts = {
  content: string;
  reasoning: string;
};

function extractContentField(message: ChatCompletionChoice['message']): string {
  if (!message) return '';
  const direct = message.content;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  if (Array.isArray(direct)) {
    return direct
      .map((part) => (typeof part?.text === 'string' ? part.text.trim() : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

export function parseAssistantMessage(
  message: ChatCompletionChoice['message'],
): AssistantMessageTexts {
  const reasoning =
    (typeof message?.reasoning_content === 'string' ? message.reasoning_content.trim() : '') ||
    (typeof message?.reasoning === 'string' ? message.reasoning.trim() : '');
  return { content: extractContentField(message), reasoning };
}

function extractMessageText(
  message: ChatCompletionChoice['message'],
  contentOnly = false,
): string {
  const { content, reasoning } = parseAssistantMessage(message);
  if (content) return content;
  if (contentOnly) return '';
  return reasoning;
}

export class LiteMaaSClientError extends Error {
  readonly isLikelyCors: boolean;

  constructor(message: string, isLikelyCors = false) {
    super(message);
    this.name = 'LiteMaaSClientError';
    this.isLikelyCors = isLikelyCors;
  }
}

function directCompletionsUrl(baseUrl: string): string {
  return `${normalizeLiteLLMBaseUrl(baseUrl)}/v1/chat/completions`;
}

function corsHelpMessage(): string {
  return (
    'Network request failed — the browser blocked the call (usually CORS). ' +
    'Run the app locally with npm run dev (built-in proxy), or ask your LiteMaaS admin to allow your site origin on the LiteLLM gateway.'
  );
}

async function postChatCompletion(
  settings: LiteMaaSSettings,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<ChatCompletionChoice> {
  const baseUrl = normalizeLiteLLMBaseUrl(settings.baseUrl);
  const apiKey = settings.apiKey.trim();
  const model = settings.model.trim();
  const useProxy = shouldUseLiteLLMProxy();

  if (!baseUrl || !apiKey) {
    throw new LiteMaaSClientError('LiteMaaS API key and base URL are required. Add them in Settings.');
  }

  const requestUrl = useProxy ? liteLLMProxyUrl() : directCompletionsUrl(baseUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (useProxy) {
    headers['X-LiteLLM-Base-Url'] = baseUrl;
  }

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options?.maxTokens ?? 1200,
        temperature: options?.temperature ?? 0.4,
      }),
    });
  } catch {
    throw new LiteMaaSClientError(corsHelpMessage(), true);
  }

  let body: ChatCompletionResponse;
  const rawText = await response.text();
  try {
    body = rawText ? (JSON.parse(rawText) as ChatCompletionResponse) : {};
  } catch {
    throw new LiteMaaSClientError(
      `Unexpected response from LiteLLM (HTTP ${response.status})${rawText ? `: ${rawText.slice(0, 120)}` : '.'}`,
    );
  }

  if (!response.ok) {
    const msg = body.error?.message ?? `LiteLLM request failed (HTTP ${response.status}).`;
    throw new LiteMaaSClientError(msg);
  }

  return body.choices?.[0] ?? {};
}

export async function chatCompletion(
  settings: LiteMaaSSettings,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number; contentOnly?: boolean },
): Promise<string> {
  const choice = await postChatCompletion(settings, messages, options);
  const content = extractMessageText(choice?.message, options?.contentOnly);
  if (!content) {
    const finish = choice?.finish_reason?.trim();
    const suffix = finish ? ` (finish_reason: ${finish})` : '';
    throw new LiteMaaSClientError(
      `LiteLLM accepted the request but returned no assistant text${suffix}. ` +
        'Check the model name in Settings, or try a non-reasoning model for the connection test.',
    );
  }
  return content;
}

/** Returns both `content` and `reasoning_content` for models that split thinking vs answer. */
export async function chatCompletionAssistant(
  settings: LiteMaaSSettings,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<AssistantMessageTexts> {
  const choice = await postChatCompletion(settings, messages, options);
  return parseAssistantMessage(choice?.message);
}

export async function testLiteMaaSConnection(settings: LiteMaaSSettings): Promise<string> {
  return chatCompletion(
    settings,
    [{ role: 'user', content: 'Reply with exactly: connected' }],
    { maxTokens: 128, temperature: 0 },
  );
}
