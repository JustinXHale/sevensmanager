import { describe, expect, it } from 'vitest';
import { normalizeLiteLLMBaseUrl } from './litellmUrl';

describe('normalizeLiteLLMBaseUrl', () => {
  it('strips trailing slash and duplicate /v1 paths', () => {
    expect(normalizeLiteLLMBaseUrl('https://litellm.example.com/')).toBe('https://litellm.example.com');
    expect(normalizeLiteLLMBaseUrl('https://litellm.example.com/v1')).toBe('https://litellm.example.com');
    expect(normalizeLiteLLMBaseUrl('https://litellm.example.com/v1/chat/completions')).toBe(
      'https://litellm.example.com',
    );
  });
});
