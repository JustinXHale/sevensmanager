/** RefLog-style tri-state (Tech Zone rosters). */
export type PlayerStatus = 'on' | 'bench' | 'off';

/** One of 13 sevens squad members for a match (own team only). */
export interface PlayerRecord {
  id: string;
  matchId: string;
  /** Optional label; display falls back to jersey number. */
  name: string;
  /** Jersey number (1–13 when using default sevens seed). */
  number: number | null;
  status: PlayerStatus;
  /**
   * Stable link to the TeamMemberRecord this player corresponds to.
   * Used to unify the same person across matches (season-level identity).
   */
  teamMemberId?: string;
  createdAt: number;
}

export interface SubstitutionRecord {
  id: string;
  matchId: string;
  /** Cumulative ms from match start (see matchClock.cumulativeMatchTimeMs). */
  matchTimeMs: number;
  period: number;
  playerOffId: string;
  playerOnId: string;
  createdAt: number;
}

/** World Rugby sevens-style squad (RefLog Tech Zone: 7 + 6). */
export const SQUAD_MAX = 13;
export const ON_FIELD_MAX = 7;

export function statusSortKey(s: PlayerStatus): number {
  switch (s) {
    case 'on':
      return 0;
    case 'bench':
      return 1;
    case 'off':
      return 2;
    default:
      return 3;
  }
}
