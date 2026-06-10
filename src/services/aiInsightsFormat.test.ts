import { describe, expect, it } from 'vitest';
import { formatAiInsightsHtml, sanitizeAiInsights } from './aiInsightsFormat';

describe('sanitizeAiInsights', () => {
  it('strips preamble before Key takeaways', () => {
    const raw = `Here's a thinking process:
1. Analyze the Request
**Key takeaways**
- First point`;
    expect(sanitizeAiInsights(raw)).toContain('Key takeaways');
    expect(sanitizeAiInsights(raw)).not.toContain('thinking process');
  });
});

describe('formatAiInsightsHtml', () => {
  it('renders bold and bullets', () => {
    const html = formatAiInsightsHtml(`**Key takeaways**
- **Strong** restart play
- Tackle rate holding`);
    expect(html).toContain('ai-insights-section-title">Key takeaways</h5>');
    expect(html).toContain('<ul class="ai-insights-list">');
    expect(html).toContain('<strong>Strong</strong>');
  });
});
