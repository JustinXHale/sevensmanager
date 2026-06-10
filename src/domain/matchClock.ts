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

/** Adjust current period time by delta ms (can be negative). Keeps the clock running if it was running. */
export function adjustCurrentPeriod(
  session: MatchSessionRecord,
  nowMs: number,
  deltaMs: number,
): MatchSessionRecord {
  const folded = session.clockRunning
    ? session.elapsedMsInCurrentPeriod + (nowMs - session.anchorWallMs)
    : session.elapsedMsInCurrentPeriod;
  const next = Math.max(0, folded + deltaMs);
  if (session.clockRunning) {
    return {
      ...session,
      elapsedMsInCurrentPeriod: next,
      anchorWallMs: nowMs,
      clockRunning: true,
    };
  }
  return {
    ...session,
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

/**
 * Format typed digits as m:ss (last two digits = seconds). Keeps manual colons as-is.
 * e.g. 48 → 0:48, 1048 → 10:48. For mobile numeric keyboards that omit ":".
 */
export function normalizeMmSsInput(input: string): string {
  const t = input.trim();
  const neg = t.startsWith('-');
  const body = neg ? t.slice(1).trim() : t;
  if (body.includes(':')) {
    return neg ? `-${body}` : body;
  }
  const digits = body.replace(/\D/g, '').slice(0, 6);
  if (!digits) return neg ? '-' : '';
  const formatted =
    digits.length <= 2
      ? `0:${digits.padStart(2, '0')}`
      : `${digits.slice(0, -2)}:${digits.slice(-2)}`;
  return neg ? `-${formatted}` : formatted;
}

/** Parse `m:ss` or `mm:ss` (e.g. 7:00, 12:34). Digits-only (e.g. 1048) also accepted. Leading `-` for negative. */
export function parseMmSsToMs(input: string): number | null {
  const t = input.trim();
  const neg = t.startsWith('-');
  const rest = neg ? t.slice(1).trim() : t;
  const normalized = rest.includes(':') ? rest : normalizeMmSsInput(rest);
  const m = /^(\d+):(\d{2})$/.exec(normalized);
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

/**
 * Resume from halftime; bank wall-clock elapsed on the footage (match clock was paused).
 */
export function exitHalfTime(session: MatchSessionRecord, nowMs: number): MatchSessionRecord {
  if (!session.halfTimeActive || session.halfTimeStartedWallMs == null) {
    return {
      ...session,
      halfTimeActive: false,
      halfTimeStartedWallMs: undefined,
    };
  }
  const gapMs = Math.max(0, nowMs - session.halfTimeStartedWallMs);
  const afterMatchMs = cumulativeMatchTimeMs(session, nowMs);
  const gaps = [...(session.filmFootageGaps ?? []), { afterMatchMs, gapMs }];
  return {
    ...session,
    halfTimeActive: false,
    halfTimeStartedWallMs: undefined,
    filmFootageGaps: gaps,
  };
}

/** Pause match + film clocks; mark full time (clears halftime if active). */
export function enterMatchComplete(session: MatchSessionRecord, nowMs: number): MatchSessionRecord {
  let s = pauseSession(session, nowMs);
  s = pauseGameSession(s, nowMs);
  s = exitHalfTime(s, nowMs);
  return {
    ...s,
    matchComplete: true,
    matchCompleteWallMs: nowMs,
  };
}

export function exitMatchComplete(session: MatchSessionRecord): MatchSessionRecord {
  return {
    ...session,
    matchComplete: false,
    matchCompleteWallMs: undefined,
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

/** Offset added when showing film times (video player position at match 0:00). */
export function filmTimeOffsetMs(session: MatchSessionRecord): number {
  return session.filmTimeOffsetMs ?? 0;
}

/** Sum of banked footage gaps (halftime, etc.) that apply at this match-clock position. */
export function footageGapBeforeMatchMs(session: MatchSessionRecord, matchMs: number): number {
  let total = 0;
  for (const g of session.filmFootageGaps ?? []) {
    if (g.afterMatchMs <= matchMs) total += g.gapMs;
  }
  return total;
}

/** Total banked footage gap ms (all completed halftimes). */
export function totalFootageGapMs(session: MatchSessionRecord): number {
  return (session.filmFootageGaps ?? []).reduce((n, g) => n + g.gapMs, 0);
}

/** Raw logged film ms → position on your video file (offset + gaps before that match time). */
export function filmTimeForDisplay(rawMs: number | undefined, offsetMs = 0, gapMs = 0): number | undefined {
  if (rawMs == null) return undefined;
  return rawMs + offsetMs + gapMs;
}

/** Video position for a logged moment (match elapsed at log + offset + prior gaps). */
export function filmDisplayMsForSession(
  session: MatchSessionRecord,
  rawMatchFilmMs: number | undefined,
): number | undefined {
  if (rawMatchFilmMs == null) return undefined;
  return (
    rawMatchFilmMs +
    filmTimeOffsetMs(session) +
    footageGapBeforeMatchMs(session, rawMatchFilmMs)
  );
}

export function formatFilmClock(rawMs: number | undefined, offsetMs = 0, gapMs = 0): string | null {
  const displayMs = filmTimeForDisplay(rawMs, offsetMs, gapMs);
  if (displayMs == null) return null;
  return formatClock(displayMs);
}

export function formatFilmClockForSession(
  session: MatchSessionRecord,
  rawMatchFilmMs: number | undefined,
): string | null {
  const displayMs = filmDisplayMsForSession(session, rawMatchFilmMs);
  if (displayMs == null) return null;
  return formatClock(displayMs);
}

/** True when film offset or banked halftime gaps are configured. */
export function sessionHasFilmSync(session: MatchSessionRecord): boolean {
  return filmTimeOffsetMs(session) > 0 || totalFootageGapMs(session) > 0;
}

export type EventTimeParts = {
  match: string;
  film: string | null;
};

/** Match clock label plus optional footage time (uses stored filmTimeMs or matchTimeMs). */
export function formatEventTimeWithFilm(
  session: MatchSessionRecord | null | undefined,
  event: { period: number; matchTimeMs: number; filmTimeMs?: number },
): EventTimeParts {
  const match = `P${event.period} ${formatClock(event.matchTimeMs)}`;
  if (!session || !sessionHasFilmSync(session)) {
    return { match, film: null };
  }
  const rawFilmMs = event.filmTimeMs ?? event.matchTimeMs;
  const filmStr = formatFilmClockForSession(session, rawFilmMs);
  return { match, film: filmStr };
}

/** Video player position now: match elapsed + offset + banked gaps + in-progress halftime wall time. */
export function videoTimeDisplayMs(session: MatchSessionRecord, nowMs: number): number {
  const matchMs = cumulativeMatchTimeMs(session, nowMs);
  const inProgressHt = session.halfTimeActive ? halfTimeElapsedDisplayMs(session, nowMs) : 0;
  return matchMs + filmTimeOffsetMs(session) + footageGapBeforeMatchMs(session, matchMs) + inProgressHt;
}

function lastFootageGapIndexAtOrBeforeMatchMs(session: MatchSessionRecord, matchMs: number): number {
  const gaps = session.filmFootageGaps ?? [];
  let last = -1;
  for (let i = 0; i < gaps.length; i++) {
    if (gaps[i].afterMatchMs <= matchMs) last = i;
  }
  return last;
}

/**
 * Align parentheses / film scrub time with the video player right now.
 * First half → adjusts kickoff offset; after a banked HT gap → adjusts that gap; during HT → shifts HT wall anchor.
 */
export type ClockDisplayPayload = {
  period: number;
  matchClockDisplayMode: MatchClockDisplayMode;
  matchCountdownLengthMs: number;
  periodClockDisplayMode: PeriodClockDisplayMode;
  periodCountdownLengthMs: number;
  matchDisplayedMs: number;
  periodDisplayedMs: number;
};

/** True when clock settings match/period fields already reflect the live session (paused at nowMs). */
export function clockDisplayMatchesSession(
  session: MatchSessionRecord,
  nowMs: number,
  payload: ClockDisplayPayload,
): boolean {
  const paused = pauseSession(session, nowMs);
  const withModes = applyClockDisplaySettings(paused, {
    matchClockDisplayMode: payload.matchClockDisplayMode,
    matchCountdownLengthMs: payload.matchCountdownLengthMs,
    periodClockDisplayMode: payload.periodClockDisplayMode,
    periodCountdownLengthMs: payload.periodCountdownLengthMs,
  });
  return (
    payload.period === paused.period &&
    payload.matchDisplayedMs === currentMatchDisplayForUi(withModes, nowMs) &&
    payload.periodDisplayedMs === currentPeriodDisplayForUi(withModes, nowMs) &&
    payload.matchClockDisplayMode === (paused.matchClockDisplayMode ?? 'up') &&
    payload.periodClockDisplayMode === (paused.periodClockDisplayMode ?? 'up') &&
    payload.matchCountdownLengthMs === (paused.matchCountdownLengthMs ?? DEFAULT_MATCH_COUNTDOWN_MS) &&
    payload.periodCountdownLengthMs === (paused.periodCountdownLengthMs ?? DEFAULT_PERIOD_COUNTDOWN_MS)
  );
}

/** Update film offset / video-now sync only — does not change match or period clocks. */
export function applyFilmSyncToSession(
  session: MatchSessionRecord,
  nowMs: number,
  offsetMs: number,
  videoTimeNowMs: number,
): MatchSessionRecord {
  let next = pauseSession(session, nowMs);
  next = { ...next, filmTimeOffsetMs: offsetMs };
  const naturalVideoMs = videoTimeDisplayMs(next, nowMs);
  if (videoTimeNowMs !== naturalVideoMs) {
    next = syncSessionVideoTimeNow(next, nowMs, videoTimeNowMs);
  }
  return next;
}

export function syncSessionVideoTimeNow(
  session: MatchSessionRecord,
  nowMs: number,
  desiredVideoMs: number,
): MatchSessionRecord {
  const current = videoTimeDisplayMs(session, nowMs);
  const delta = desiredVideoMs - current;
  if (delta === 0) return session;

  if (session.halfTimeActive && session.halfTimeStartedWallMs != null) {
    return {
      ...session,
      halfTimeStartedWallMs: session.halfTimeStartedWallMs - delta,
    };
  }

  const matchMs = cumulativeMatchTimeMs(session, nowMs);
  const gapIdx = lastFootageGapIndexAtOrBeforeMatchMs(session, matchMs);
  if (gapIdx >= 0) {
    const gaps = [...(session.filmFootageGaps ?? [])];
    gaps[gapIdx] = {
      ...gaps[gapIdx],
      gapMs: Math.max(0, gaps[gapIdx].gapMs + delta),
    };
    return { ...session, filmFootageGaps: gaps };
  }

  return {
    ...session,
    filmTimeOffsetMs: Math.max(0, filmTimeOffsetMs(session) + delta),
  };
}

/** Effective offset for display helpers that take a single offset number. */
export function filmDisplayOffsetForMatchMs(session: MatchSessionRecord, matchMs: number): number {
  return filmTimeOffsetMs(session) + footageGapBeforeMatchMs(session, matchMs);
}
