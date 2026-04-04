import type { MatchRecord } from './match';

/** Primary line for lists and clock: both sides when available. */
export function derivedFixtureLabel(m: MatchRecord): string {
  const us = m.ourTeamName?.trim();
  const them = m.opponentName?.trim();
  if (us && them) return `${us} vs ${them}`;
  if (them && !us) return `vs ${them}`;
  if (us && !them) return us;
  if (m.title?.trim()) return m.title.trim();
  return 'Untitled match';
}
