function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** Drop chain-of-thought preamble; keep coaching output only. */
export function sanitizeAiInsights(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  const takeawayIdx = text.search(/\*\*?\s*key takeaways\s*\*\*?/i);
  if (takeawayIdx > 0) {
    text = text.slice(takeawayIdx);
  }

  text = text.replace(/^here'?s a thinking process:?[\s\S]*?(?=\*\*?\s*key takeaways)/i, '');
  text = text.replace(/^\d+\.\s*analyze[\s\S]*?(?=\*\*?\s*key takeaways)/i, '');

  const lines = text.split('\n');
  const filtered = lines.filter((line) => {
    const t = line.trim().toLowerCase();
    if (!t) return true;
    if (t.startsWith("here's a thinking process")) return false;
    if (/^\d+\.\s*(analyze|extract|map|check|draft)/i.test(line.trim())) return false;
    if (t.startsWith('*draft')) return false;
    return true;
  });

  return filtered.join('\n').trim();
}

/** Render sanitized plain-text / light markdown insights for display. */
export function formatAiInsightsHtml(raw: string): string {
  const text = sanitizeAiInsights(raw);
  if (!text) return '';

  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(`<ul class="ai-insights-list">${listItems.join('')}</ul>`);
    listItems = [];
  };

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      listItems.push(`<li>${inlineMarkdown(bullet[1]!)}</li>`);
      continue;
    }

    flushList();

    const heading = trimmed.match(/^\*\*([^*]+)\*\*:?\s*$/);
    if (heading) {
      blocks.push(`<h5 class="ai-insights-section-title">${escapeHtml(heading[1]!)}</h5>`);
      continue;
    }

    blocks.push(`<p class="ai-insights-para">${inlineMarkdown(trimmed)}</p>`);
  }

  flushList();
  return blocks.join('');
}
