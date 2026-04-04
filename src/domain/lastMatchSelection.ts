import type { MatchRecord } from '@/domain/match';

const STORAGE_PREFIX = 'sevensmanager:lastMatchId:';

export function lastMatchStorageKey(teamId: string): string {
  return `${STORAGE_PREFIX}${teamId}`;
}

export function getLastMatchIdForTeam(teamId: string): string | null {
  try {
    const v = localStorage.getItem(lastMatchStorageKey(teamId));
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setLastMatchIdForTeam(teamId: string, matchId: string): void {
  try {
    localStorage.setItem(lastMatchStorageKey(teamId), matchId);
  } catch {
    /* quota / private mode */
  }
}

/**
 * Prefer stored id if it exists in the list; otherwise the first row (same order as
 * `listMatchesForTeam`: newest / best-dated first).
 */
export function pickDefaultMatchId(matches: MatchRecord[], preferred: string | null): string | null {
  if (matches.length === 0) return null;
  if (preferred && matches.some((m) => m.id === preferred)) return preferred;
  return matches[0]!.id;
}
