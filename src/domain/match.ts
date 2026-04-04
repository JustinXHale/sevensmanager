/** Persisted match (product §6). */
export interface MatchRecord {
  id: string;
  title: string;
  /** Your team label on the fixture (optional; used with opponent for “Us vs Them”). */
  ourTeamName?: string;
  opponentName?: string;
  /** Short abbreviation for the scoreboard timer (e.g. "NSR"). Auto-filled from club. */
  ourAbbreviation?: string;
  /** Short abbreviation for the opponent on the scoreboard (e.g. "EEM"). */
  opponentAbbreviation?: string;
  /** ISO date string (date-only or full ISO) for sorting */
  kickoffDate?: string;
  /** Pitch / venue / city (manual entry or CSV column). */
  location?: string;
  /** Free-text competition name (legacy + display). */
  competition?: string;
  /** Optional link to structured competition (admin). */
  competitionId?: string;
  /** Optional link to structured team — the side you track (admin). */
  teamId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Count up (elapsed) or down (remaining vs a length). */
export type TimerCountMode = 'up' | 'down';
export type MatchClockDisplayMode = TimerCountMode;
export type PeriodClockDisplayMode = TimerCountMode;

/** Session / clock state per match (product §7). */
export interface MatchSessionRecord {
  matchId: string;
  /** Match segment 1–10 (regulation halves, extra time, etc.); wraps 10 → 1 on advance. */
  period: number;
  clockRunning: boolean;
  /** When `clockRunning`, wall-clock ms at start of current run segment */
  anchorWallMs: number;
  /** Accumulated ms in the current period excluding the active run segment */
  elapsedMsInCurrentPeriod: number;
  /**
   * Sum of finalized elapsed time for all completed periods before the current one.
   * Replaces relying only on `completedMsP1` for multi-period matches.
   */
  cumulativeMsBeforeCurrentPeriod: number;
  /** @deprecated Use `cumulativeMsBeforeCurrentPeriod`; kept for sessions saved before multi-period. */
  completedMsP1?: number;
  /** @deprecated Optional legacy P2 total. */
  completedMsP2?: number;
  /** Halftime: match + film clocks paused; UI shows count-up since start. */
  halfTimeActive?: boolean;
  /** Wall time when halftime started (for elapsed display). */
  halfTimeStartedWallMs?: number;
  /**
   * Film / wall clock (RefLog “game” clock): continuous elapsed for correlating with footage.
   * Independent of match stoppages.
   */
  gameClockRunning: boolean;
  gameAnchorWallMs: number;
  gameElapsedMs: number;
  /**
   * Cumulative match-time ms while each player was on field (match clock running).
   * Updated on flush (pause, periodic save, sub, etc.).
   */
  playerMinutesMs?: Record<string, number>;
  /** `cumulativeMatchTimeMs` at last minutes flush; used to compute in-progress segment. */
  minutesLedgerMatchMs?: number;
  /** Match row: elapsed up, or countdown from `matchCountdownLengthMs`. */
  matchClockDisplayMode?: MatchClockDisplayMode;
  /** Regulation / display length for match countdown (default 14:00). */
  matchCountdownLengthMs?: number;
  /** Period row: elapsed up, or countdown from `periodCountdownLengthMs`. */
  periodClockDisplayMode?: PeriodClockDisplayMode;
  /** Length of period segment for countdown display (default 7:00). */
  periodCountdownLengthMs?: number;
}

/** Max period segment index (advance wraps to 1). */
export const SESSION_PERIOD_MAX = 99;

/** Backfill fields for sessions saved before film clock existed. */
export function clampSessionPeriod(n: number): number {
  if (Number.isNaN(n) || n < 1) return 1;
  if (n > SESSION_PERIOD_MAX) return SESSION_PERIOD_MAX;
  return Math.floor(n);
}

export function normalizeSession(raw: MatchSessionRecord | undefined): MatchSessionRecord | undefined {
  if (!raw) return undefined;
  const period = clampSessionPeriod(typeof raw.period === 'number' ? raw.period : raw.period === 2 ? 2 : 1);
  const legacyP1 = raw.completedMsP1 ?? 0;
  const cumulative =
    raw.cumulativeMsBeforeCurrentPeriod ??
    (period >= 2 ? legacyP1 : 0);
  return {
    ...raw,
    period,
    cumulativeMsBeforeCurrentPeriod: cumulative,
    completedMsP1: raw.completedMsP1 ?? 0,
    completedMsP2: raw.completedMsP2 ?? 0,
    gameClockRunning: raw.gameClockRunning ?? false,
    gameAnchorWallMs: raw.gameAnchorWallMs ?? 0,
    gameElapsedMs: raw.gameElapsedMs ?? 0,
    playerMinutesMs: raw.playerMinutesMs ?? {},
    halfTimeActive: raw.halfTimeActive ?? false,
    matchClockDisplayMode: raw.matchClockDisplayMode ?? 'up',
    matchCountdownLengthMs: raw.matchCountdownLengthMs ?? 14 * 60 * 1000,
    periodClockDisplayMode: raw.periodClockDisplayMode ?? 'up',
    periodCountdownLengthMs: raw.periodCountdownLengthMs ?? 7 * 60 * 1000,
  };
}

export function defaultSessionForMatch(matchId: string): MatchSessionRecord {
  return {
    matchId,
    period: 1,
    clockRunning: false,
    anchorWallMs: 0,
    elapsedMsInCurrentPeriod: 0,
    cumulativeMsBeforeCurrentPeriod: 0,
    completedMsP1: 0,
    completedMsP2: 0,
    gameClockRunning: false,
    gameAnchorWallMs: 0,
    gameElapsedMs: 0,
    halfTimeActive: false,
    matchClockDisplayMode: 'up',
    matchCountdownLengthMs: 14 * 60 * 1000,
    periodClockDisplayMode: 'up',
    periodCountdownLengthMs: 7 * 60 * 1000,
  };
}

/** Reset match clock fields to a new-match state. Keeps film / game clock running state and elapsed. Clears on-field minutes ledger. */
export function resetMatchClockSession(session: MatchSessionRecord): MatchSessionRecord {
  const fresh = defaultSessionForMatch(session.matchId);
  return {
    ...fresh,
    gameClockRunning: session.gameClockRunning,
    gameAnchorWallMs: session.gameAnchorWallMs,
    gameElapsedMs: session.gameElapsedMs,
    playerMinutesMs: {},
    minutesLedgerMatchMs: undefined,
  };
}

/** Sort key: kickoff date first, else created time (desc in UI). */
export function matchListSortKey(m: MatchRecord): number {
  if (m.kickoffDate) {
    const t = Date.parse(m.kickoffDate);
    if (!Number.isNaN(t)) return t;
  }
  return m.createdAt;
}
