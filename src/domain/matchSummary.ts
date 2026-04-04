import type { MatchRecord } from '@/domain/match';
import type { MatchEventRecord } from '@/domain/matchEvent';
import { formatClock } from '@/domain/matchClock';
import { formatMatchEventSummary } from '@/domain/matchEventDisplay';
import { countEventsByKind, kindLabel, tackleMadeMissed, triesByZone } from '@/domain/matchStats';
import type { PlayerRecord, SubstitutionRecord } from '@/domain/player';
import { ZONE_IDS } from '@/domain/zone';

/**
 * Plain-text summary for clipboard (product §9 optional).
 * Events are listed oldest → newest by match time.
 */
export function buildMatchSummaryText(
  match: MatchRecord,
  events: MatchEventRecord[],
  substitutions: SubstitutionRecord[],
  playersById: Map<string, PlayerRecord>,
): string {
  const title = match.title?.trim() || 'Match';
  const lines: string[] = [title];
  if (match.ourTeamName?.trim() || match.opponentName?.trim()) {
    const us = match.ourTeamName?.trim() ?? 'Us';
    const them = match.opponentName?.trim() ?? 'Them';
    lines.push(`${us} vs ${them}`);
  }
  if (match.competition?.trim()) lines.push(`Competition: ${match.competition.trim()}`);
  if (match.kickoffDate?.trim()) lines.push(`Kickoff: ${match.kickoffDate.trim()}`);
  lines.push('');

  const byKind = countEventsByKind(events);
  const { made: tacklesMade, missed: tacklesMissed } = tackleMadeMissed(events);
  const triesZ = triesByZone(events);

  lines.push('--- Totals ---');
  for (const kind of [
    'try',
    'conversion',
    'opponent_try',
    'opponent_conversion',
    'opponent_substitution',
    'opponent_card',
    'pass',
    'line_break',
    'negative_action',
    'tackle',
    'ruck',
    'scrum',
    'lineout',
    'team_penalty',
  ] as const) {
    const n = byKind[kind] ?? 0;
    if (n > 0) lines.push(`${kindLabel(kind)}: ${n}`);
  }
  lines.push(`Tackles made: ${tacklesMade}`);
  lines.push(`Tackles missed: ${tacklesMissed}`);
  lines.push(`Substitutions: ${substitutions.length}`);
  lines.push('');

  lines.push('--- Tries by zone ---');
  for (const z of ZONE_IDS) {
    const n = triesZ[z];
    if (n > 0) lines.push(`${z}: ${n}`);
  }
  lines.push('');

  const sorted = [...events].sort((a, b) => a.matchTimeMs - b.matchTimeMs || a.createdAt - b.createdAt);
  lines.push('--- Event log (oldest first) ---');
  if (sorted.length === 0) {
    lines.push('(no events)');
  } else {
    for (const e of sorted) {
      lines.push(
        `P${e.period} ${formatClock(e.matchTimeMs)} · ${formatMatchEventSummary(e, playersById)}`,
      );
    }
  }

  return lines.join('\n');
}
