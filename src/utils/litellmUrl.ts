/** Normalize user-entered LiteLLM base URL (no trailing slash or duplicate /v1). */
export function normalizeLiteLLMBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  url = url.replace(/\/v1\/chat\/completions$/i, '');
  url = url.replace(/\/chat\/completions$/i, '');
  url = url.replace(/\/v1$/i, '');
  return url.replace(/\/+$/, '');
}

/** Same-origin proxy path (dev/preview server forwards to X-LiteLLM-Base-Url). */
export function liteLLMProxyUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  const path = `${base}api/litellm/v1/chat/completions`.replace(/([^:]\/)\/+/g, '$1');
  if (typeof window !== 'undefined') {
    return new URL(path, window.location.origin).href;
  }
  return path;
}

/** Local dev/preview uses the built-in Vite proxy to avoid browser CORS blocks. */
export function shouldUseLiteLLMProxy(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}
