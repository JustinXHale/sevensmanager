import {
  SESSION_PERIOD_MAX,
  type MatchClockDisplayMode,
  type MatchSessionRecord,
  type PeriodClockDisplayMode,
} from './match';

const SEVEN_MS = 7 * 60 * 1000;
const FOURTEEN_MS = 14 * 60 * 1000;

/** Default period length for countdown display (7:00). */
export const DEFAULT_PERIOD_COUNTDOWN_MS = 7 * 60 * 1000;

/** Default match countdown length (e.g. regulation display). */
export const DEFAULT_MATCH_COUNTDOWN_MS = 14 * 60 * 1000;

/** Sum of finalized time before the current period (legacy + new field). */
function cumulativeBefore(session: MatchSessionRecord): number {
  if (session.cumulativeMsBeforeCurrentPeriod !== undefined) {
    return session.cumulativeMsBeforeCurrentPeriod;
  }
  return session.period >= 2 ? session.completedMsP1 ?? 0 : 0;
}

/**
 * Match time already “locked in” from before this segment (after Next period or Halftime).
 * Not related to tries, subs, or penalties in the log.
 */
export function bankedMatchMsBeforeCurrentPeriod(session: MatchSessionRecord): number {
  return cumulativeBefore(session);
}

/** Displayed elapsed ms for the *current* period only. */
export function currentPeriodElapsedDisplayMs(
  session: MatchSessionRecord,
  nowMs: number,
): number {
  if (session.clockRunning) {
    return session.elapsedMsInCurrentPeriod + (nowMs - session.anchorWallMs);
  }
  return session.elapsedMsInCurrentPeriod;
}

/** Pause running clock: fold running segment into elapsed. */
export function pauseSession(session: MatchSessionRecord, nowMs: number): MatchSessionRecord {
  if (!session.clockRunning) return session;
  return {
    ...session,
    clockRunning: false,
    elapsedMsInCurrentPeriod: session.elapsedMsInCurrentPeriod + (nowMs - session.anchorWallMs),
    anchorWallMs: 0,
  };
}

/** Resume from paused. */
export function resumeSession(session: MatchSessionRecord, nowMs: number): MatchSessionRecord {
  if (session.clockRunning) return session;
  const nowMatch = cumulativeMatchTimeMs(session, nowMs);
  return {
    ...session,
    clockRunning: true,
    anchorWallMs: nowMs,
    minutesLedgerMatchMs: session.minutesLedgerMatchMs ?? nowMatch,
  };
}

/**
 * Advance to the next period (1→…→max→1). Freezes current segment into cumulative time;
 * per-period clock resets to 0.
 */
export function advancePeriod(session: MatchSessionRecord, nowMs: number): MatchSessionRecord {
  const paused = pauseSession(session, nowMs);
  const curElapsed = currentPeriodElapsedDisplayMs(paused, nowMs);
  const before = cumulativeBefore(paused);
  const nextPeriod = paused.period >= SESSION_PERIOD_MAX ? 1 : paused.period + 1;
  const nextCumulative = before + curElapsed;
  return {
    ...paused,
    period: nextPeriod,
    clockRunning: false,
    elapsedMsInCurrentPeriod: 0,
    anchorWallMs: 0,
    cumulativeMsBeforeCurrentPeriod: nextCumulative,
    completedMsP1: paused.period === 1 ? curElapsed : paused.completedMsP1 ?? 0,
  };
}

/** @deprecated Same as `advancePeriod` (legacy name). */
export function advanceToSecondHalf(
  session: MatchSessionRecord,
  nowMs: number,
): MatchSessionRecord {
  return advancePeriod(session, nowMs);
}

/** Adjust current period time by delta ms (can be negative). */
export function adjustCurrentPeriod(
  session: MatchSessionRecord,
  nowMs: number,
  deltaMs: number,
): MatchSessionRecord {
  const base = pauseSession(session, nowMs);
  const next = Math.max(0, base.elapsedMsInCurrentPeriod + deltaMs);
  return {
    ...base,
    elapsedMsInCurrentPeriod: next,
  };
}

/** Total elapsed ms from match start (all periods). */
export function cumulativeMatchTimeMs(session: MatchSessionRecord, nowMs: number): number {
  return cumulativeBefore(session) + currentPeriodElapsedDisplayMs(session, nowMs);
}

function matchDisplayCountdownLength(session: MatchSessionRecord): number {
  return session.matchCountdownLengthMs ?? DEFAULT_MATCH_COUNTDOWN_MS;
}

function periodCountdownLength(session: MatchSessionRecord): number {
  return session.periodCountdownLengthMs ?? DEFAULT_PERIOD_COUNTDOWN_MS;
}

/**
 * Match row: total elapsed (up) or remaining vs {@link matchDisplayCountdownLength} (down; overtime = negative).
 */
export function currentMatchDisplayForUi(session: MatchSessionRecord, nowMs: number): number {
  const cum = cumulativeMatchTimeMs(session, nowMs);
  const mode = session.matchClockDisplayMode ?? 'up';
  if (mode === 'up') return cum;
  return matchDisplayCountdownLength(session) - cum;
}

/**
 * Value shown on the period row: elapsed (up) or remaining (down).
 * When counting down, remaining may be negative after the segment length (overtime).
 */
export function currentPeriodDisplayForUi(session: MatchSessionRecord, nowMs: number): number {
  const elapsed = currentPeriodElapsedDisplayMs(session, nowMs);
  const mode = session.periodClockDisplayMode ?? 'up';
  if (mode === 'up') return elapsed;
  const len = periodCountdownLength(session);
  return len - elapsed;
}

/** Parse `m:ss` or `mm:ss` (e.g. 7:00, 12:34). Leading `-` for negative (e.g. -1:30). */
export function parseMmSsToMs(input: string): number | null {
  const t = input.trim();
  const neg = t.startsWith('-');
  const rest = neg ? t.slice(1).trim() : t;
  const m = /^(\d+):(\d{2})$/.exec(rest);
  if (!m) return null;
  const min = parseInt(m[1], 10);
  const sec = parseInt(m[2], 10);
  if (sec >= 60 || min < 0) return null;
  const val = (min * 60 + sec) * 1000;
  return neg ? -val : val;
}

export type SetMatchTotalResult = MatchSessionRecord | { error: string };

/**
 * Set total match elapsed to `totalMs` (paused session). Fails if total is before cumulative time from prior periods.
 */
export function setMatchTotalElapsedMs(session: MatchSessionRecord, totalMs: number): SetMatchTotalResult {
  const before = cumulativeBefore(session);
  if (totalMs < before) {
    return {
      error: `Match total can’t be less than ${formatClock(before)}. That’s time already stored when you moved to this segment (Next or Halftime)—not from the play-by-play log.`,
    };
  }
  return {
    ...session,
    elapsedMsInCurrentPeriod: totalMs - before,
  };
}

/**
 * Set match time from the value shown in the UI (elapsed if up, remaining if down).
 */
export function setMatchTotalFromDisplayedValue(
  session: MatchSessionRecord,
  displayedMs: number,
): SetMatchTotalResult {
  const mode = session.matchClockDisplayMode ?? 'up';
  if (mode === 'up') {
    return setMatchTotalElapsedMs(session, displayedMs);
  }
  const len = matchDisplayCountdownLength(session);
  return setMatchTotalElapsedMs(session, len - displayedMs);
}

/**
 * Set period row from displayed value: elapsed (up) or remaining (down).
 * Countdown remaining may be negative (overtime); stored elapsed = len − remaining.
 */
export function setPeriodFromDisplayedMs(session: MatchSessionRecord, displayedMs: number): MatchSessionRecord {
  const mode = session.periodClockDisplayMode ?? 'up';
  const len = periodCountdownLength(session);
  if (mode === 'up') {
    return {
      ...session,
      elapsedMsInCurrentPeriod: Math.max(0, displayedMs),
    };
  }
  return {
    ...session,
    elapsedMsInCurrentPeriod: Math.max(0, len - displayedMs),
  };
}

export function applyClockDisplaySettings(
  session: MatchSessionRecord,
  patch: {
    matchClockDisplayMode?: MatchClockDisplayMode;
    matchCountdownLengthMs?: number;
    periodClockDisplayMode?: PeriodClockDisplayMode;
    periodCountdownLengthMs?: number;
  },
): MatchSessionRecord {
  return {
    ...session,
    ...patch,
  };
}

export function applyPeriodClockSettings(
  session: MatchSessionRecord,
  patch: { periodClockDisplayMode?: PeriodClockDisplayMode; periodCountdownLengthMs?: number },
): MatchSessionRecord {
  return applyClockDisplaySettings(session, patch);
}


/** After manual clock edits, align minutes ledger to current cumulative time. */
export function syncMinutesLedgerToMatchClock(session: MatchSessionRecord, nowMs: number): MatchSessionRecord {
  return {
    ...session,
    minutesLedgerMatchMs: cumulativeMatchTimeMs(session, nowMs),
  };
}

/**
 * Blink thresholds: period 1 when cumulative ≥ 7:00; period ≥ 2 when cumulative ≥ 14:00.
 */
export function shouldBlinkMatchThreshold(session: MatchSessionRecord, nowMs: number): boolean {
  const total = cumulativeMatchTimeMs(session, nowMs);
  if (session.period === 1 && total >= SEVEN_MS) return true;
  if (session.period >= 2 && total >= FOURTEEN_MS) return true;
  return false;
}

/** Format `m:ss`. Supports negative values (e.g. countdown overtime). */
export function formatClock(ms: number): string {
  const sign = ms < 0 ? '-' : '';
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

/** Elapsed wall time since halftime started (0 if not in halftime). */
export function halfTimeElapsedDisplayMs(session: MatchSessionRecord, nowMs: number): number {
  if (!session.halfTimeActive || session.halfTimeStartedWallMs === undefined) return 0;
  return nowMs - session.halfTimeStartedWallMs;
}

/** Pause match + film clocks; start halftime wall timer. */
export function enterHalfTime(session: MatchSessionRecord, nowMs: number): MatchSessionRecord {
  let s = pauseSession(session, nowMs);
  s = pauseGameSession(s, nowMs);
  return {
    ...s,
    halfTimeActive: true,
    halfTimeStartedWallMs: nowMs,
  };
}

export function exitHalfTime(session: MatchSessionRecord): MatchSessionRecord {
  return {
    ...session,
    halfTimeActive: false,
    halfTimeStartedWallMs: undefined,
  };
}

// —— Film / wall clock (continuous; RefLog “game” clock) ——

export function currentGameElapsedDisplayMs(session: MatchSessionRecord, nowMs: number): number {
  if (session.gameClockRunning) {
    return session.gameElapsedMs + (nowMs - session.gameAnchorWallMs);
  }
  return session.gameElapsedMs;
}

export function pauseGameSession(session: MatchSessionRecord, nowMs: number): MatchSessionRecord {
  if (!session.gameClockRunning) return session;
  return {
    ...session,
    gameClockRunning: false,
    gameElapsedMs: session.gameElapsedMs + (nowMs - session.gameAnchorWallMs),
    gameAnchorWallMs: 0,
  };
}

export function resumeGameSession(session: MatchSessionRecord, nowMs: number): MatchSessionRecord {
  if (session.gameClockRunning) return session;
  return {
    ...session,
    gameClockRunning: true,
    gameAnchorWallMs: nowMs,
  };
}

export function adjustGameElapsed(
  session: MatchSessionRecord,
  nowMs: number,
  deltaMs: number,
): MatchSessionRecord {
  const base = pauseGameSession(session, nowMs);
  return {
    ...base,
    gameElapsedMs: Math.max(0, base.gameElapsedMs + deltaMs),
  };
}
