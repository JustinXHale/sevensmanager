import { statsBriefToJson, type StatsBrief } from '@/domain/statsBrief';
import { sanitizeAiInsights } from '@/services/aiInsightsFormat';
import { chatCompletionAssistant, type ChatMessage } from '@/services/litemaasClient';
import type { LiteMaaSSettings } from '@/utils/litemaasSettings';

const INSIGHTS_CACHE_PREFIX = 'sevensmanager.aiInsights.';

const SYSTEM_PROMPT = `You are a rugby sevens coaching analyst helping a team staff member interpret match analytics.

Rules:
- Use ONLY numbers and facts from the provided stats JSON. Do not invent events, players, or scores.
- If a metric is null or missing, say data was not tracked — do not guess.
- Do NOT show your reasoning, analysis steps, drafts, or thinking process. Output ONLY the final coaching text.
- Use rugby sevens context (7-a-side, short halves, pace, restart importance, ruck speed).
- Metric glossary:
  - Forced turnovers = count of forced_turnover events from the Defense button (direct logs only — do not derive or combine into a turnover balance formula).
  - Ruck speed medians are in milliseconds in JSON; typical sevens rucks finish in under 6 seconds. Use inferred.ruck.attack/defense contested/uncontested medians — they are phase-specific.
  - LB → try % = tries divided by line breaks. Low % means breaks not finished.
  - Possession swings = defense ruck won then our pass within 45s.
  - Pen net (attack/defense) = penalties drawn minus conceded in that phase.
  - Error clusters = costly knock-ons punished within 90s.
  - System moments = positive attack structure plays logged deliberately.
  - Opp passes per defense min = opponent pass rate while we are defending.

Output format (use section titles exactly as shown, with **bold** titles; bullet lines start with "- "):
**Key takeaways**
- (3 to 5 bullets)

**Strengths**
- (1 to 3 bullets)

**Areas to address**
- (1 to 3 bullets)

Then one short closing sentence for the coaching staff (no bullet).

Keep total response under 350 words. Be direct and actionable.`;

function scopeLabel(brief: StatsBrief): string {
  if (brief.scope === 'match') {
    const m = brief.match;
    const teams = [m.ourTeamName, m.opponent].filter(Boolean).join(' vs ');
    return `single match${teams ? ` (${teams})` : ''}`;
  }
  if (brief.filter === 'single_match' && brief.matchLabel) {
    return `team stats filtered to one match (${brief.matchLabel})`;
  }
  return `team stats across ${brief.matchCount} match(es)`;
}

function buildUserPrompt(brief: StatsBrief): string {
  return `Analyze these rugby sevens stats for ${scopeLabel(brief)}.

Stats JSON:
${statsBriefToJson(brief)}

Reply with ONLY the three sections (**Key takeaways**, **Strengths**, **Areas to address**) plus one closing sentence. No thinking process, no numbered steps, no drafts.`;
}

export function insightsCacheKey(key: string): string {
  return `${INSIGHTS_CACHE_PREFIX}${key}`;
}

export function getCachedInsights(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(insightsCacheKey(key));
  } catch {
    return null;
  }
}

export function setCachedInsights(key: string, text: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(insightsCacheKey(key), text);
  } catch {
    /* quota / private mode */
  }
}

export function clearCachedInsights(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(insightsCacheKey(key));
  } catch {
    /* ignore */
  }
}

function coachingTextScore(text: string): number {
  let score = 0;
  if (/\*\*strengths\*\*/i.test(text)) score += 12;
  if (/\*\*areas to address\*\*/i.test(text)) score += 12;
  if (/\*\*key takeaways\*\*/i.test(text)) score += 8;
  if (/thinking process/i.test(text)) score -= 40;
  if (/analyze user input/i.test(text)) score -= 25;
  if (/^\d+\.\s+\*\*/m.test(text)) score -= 15;
  return score + Math.min(text.length / 200, 5);
}

function pickCoachingText(parts: string[]): string {
  const candidates = parts.map((p) => p.trim()).filter(Boolean);
  if (candidates.length === 0) return '';

  let best = '';
  let bestScore = -Infinity;
  for (const raw of candidates) {
    const cleaned = sanitizeAiInsights(raw);
    if (!cleaned) continue;
    const score = coachingTextScore(cleaned);
    if (score > bestScore) {
      bestScore = score;
      best = cleaned;
    }
  }
  return best;
}

export async function generateAiInsights(
  settings: LiteMaaSSettings,
  brief: StatsBrief,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(brief) },
  ];
  const { content, reasoning } = await chatCompletionAssistant(settings, messages, {
    maxTokens: 900,
    temperature: 0.25,
  });
  const cleaned = pickCoachingText([content, reasoning]);
  if (!cleaned.trim()) {
    throw new Error(
      'Model returned analysis steps instead of coaching text. Try Regenerate, or use a non-reasoning model in Settings.',
    );
  }
  return cleaned;
}
