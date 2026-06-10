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

  it('uses the last Key takeaways block when thinking appears earlier in rules', () => {
    const raw = `Here's a thinking process:
1. **Analyze User Input**
   - Output format mentions Key takeaways
4. **Draft**
   Key takeaways:
   - Real bullet one
**Strengths**
- Strong ruck speed`;
    const out = sanitizeAiInsights(raw);
    expect(out).toContain('Real bullet one');
    expect(out).not.toContain('Analyze User Input');
  });

  it('returns empty when only thinking with no takeaways', () => {
    expect(sanitizeAiInsights("Here's a thinking process:\n1. Analyze")).toBe('');
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
