import { statsBriefToJson, type StatsBrief } from '@/domain/statsBrief';
import { chatCompletion, type ChatMessage } from '@/services/litemaasClient';
import type { LiteMaaSSettings } from '@/utils/litemaasSettings';

const INSIGHTS_CACHE_PREFIX = 'sevensmanager.aiInsights.';

const SYSTEM_PROMPT = `You are a rugby sevens coaching analyst helping a team staff member interpret match analytics.

Rules:
- Use ONLY numbers and facts from the provided stats JSON. Do not invent events, players, or scores.
- If a metric is null or missing, say data was not tracked — do not guess.
- Use rugby sevens context (7-a-side, short halves, pace, restart importance, ruck speed, turnover balance).
- Metric glossary:
  - Turnover balance = forced turnovers minus (negatives + penalties conceded). Positive is good.
  - LB → try % = tries divided by line breaks. Low % means breaks not finished.
  - Possession swings = defense ruck won then our pass within 45s.
  - Pen net (attack/defense) = penalties drawn minus conceded in that phase.
  - Error clusters = costly knock-ons punished within 90s.
  - System moments = positive attack structure plays logged deliberately.
  - Opp passes per defense min = opponent pass rate while we are defending.

Output format (plain text, no markdown headers):
1) "Key takeaways" — 3 to 5 bullet lines starting with "- "
2) Blank line
3) "Strengths" — 1 to 3 bullet lines starting with "- "
4) Blank line
5) "Areas to address" — 1 to 3 bullet lines starting with "- "
6) Blank line
7) One short closing sentence for the coaching staff.

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
${statsBriefToJson(brief)}`;
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

export async function generateAiInsights(
  settings: LiteMaaSSettings,
  brief: StatsBrief,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(brief) },
  ];
  return chatCompletion(settings, messages);
}
