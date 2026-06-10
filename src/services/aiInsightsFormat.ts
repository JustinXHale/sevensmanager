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

const ANALYSIS_LINE =
  /^(here'?s a thinking|thinking process|\d+\.\s+\*?\*?(analyze|extract|map|check|draft)|\*+draft|role:|task:|rules:|output format:|- use only|- if a metric|- do not)/i;

const ANALYSIS_INLINE = /analyze (user input|request)|extract key data|map to rugby|mental refinement/i;

function findCoachingStart(text: string): number {
  const markers = [
    /\*\*key takeaways\*\*/gi,
    /(?:^|\n)\s*key takeaways\s*:\s*(?:\n|$)/gi,
  ];
  let last = -1;
  for (const marker of markers) {
    for (const m of text.matchAll(marker)) {
      if (m.index != null) last = Math.max(last, m.index);
    }
  }
  return last;
}

function isAnalysisLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (ANALYSIS_LINE.test(t)) return true;
  if (ANALYSIS_INLINE.test(t)) return true;
  if (/^\d+\.\s+\*\*/.test(t)) return true;
  if (/^-\s+\*\*(role|task|rules)\*\*/i.test(t)) return true;
  return false;
}

/** Drop chain-of-thought preamble; keep coaching output only. */
export function sanitizeAiInsights(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  if (/thinking process/i.test(text) || /analyze user input/i.test(text)) {
    const start = findCoachingStart(text);
    if (start >= 0) {
      text = text.slice(start);
    } else {
      return '';
    }
  }

  const lines = text.split('\n');
  const filtered = lines.filter((line) => !isAnalysisLine(line));

  text = filtered.join('\n').trim();

  text = text.replace(/^key takeaways\s*:?\s*\n?/i, '**Key takeaways**\n');

  if (/thinking process/i.test(text) || /analyze user input/i.test(text)) {
    return '';
  }

  return text;
}

/** Render sanitized plain-text / light markdown insights for display. */
export function formatAiInsightsHtml(raw: string): string {
  const text = sanitizeAiInsights(raw);
  if (!text) {
    return '<p class="ai-insights-para muted">Could not extract coaching text — tap Regenerate insights.</p>';
  }

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
    if (isAnalysisLine(trimmed)) continue;

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

    const plainHeading = trimmed.match(/^(key takeaways|strengths|areas to address)\s*:?\s*$/i);
    if (plainHeading) {
      blocks.push(
        `<h5 class="ai-insights-section-title">${escapeHtml(plainHeading[1]!.replace(/\b\w/g, (c) => c.toUpperCase()))}</h5>`,
      );
      continue;
    }

    blocks.push(`<p class="ai-insights-para">${inlineMarkdown(trimmed)}</p>`);
  }

  flushList();
  return blocks.join('');
}
