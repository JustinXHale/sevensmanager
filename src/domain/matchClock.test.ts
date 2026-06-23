import { describe, expect, it } from 'vitest';
import type { MatchSessionRecord } from './match';
import {
  adjustCurrentPeriod,
  adjustGameElapsed,
  advancePeriod,
  advanceToSecondHalf,
  cumulativeMatchTimeMs,
  currentGameElapsedDisplayMs,
  currentMatchDisplayForUi,
  currentPeriodDisplayForUi,
  currentPeriodElapsedDisplayMs,
  exitHalfTime,
  enterRefStoppage,
  exitRefStoppage,
  refStoppageElapsedDisplayMs,
  filmTimeForDisplay,
  footageGapBeforeMatchMs,
  formatClock,
  formatEventTimeWithFilm,
  formatFilmClock,
  normalizeMmSsInput,
  parseMmSsToMs,
  applyFilmSyncToSession,
  clockDisplayMatchesSession,
  syncSessionVideoTimeNow,
  videoTimeDisplayMs,
  pauseGameSession,
  pauseSession,
  resumeGameSession,
  resumeSession,
  setPeriodFromDisplayedMs,
  shouldBlinkMatchThreshold,
  enterMatchComplete,
  exitMatchComplete,
} from './matchClock';

function baseSession(over: Partial<MatchSessionRecord> = {}): MatchSessionRecord {
  return {
    matchId: 'm1',
    period: 1,
    clockRunning: false,
    anchorWallMs: 0,
    elapsedMsInCurrentPeriod: 0,
    cumulativeMsBeforeCurrentPeriod: 0,
    completedMsP1: 0,
    completedMsP2: 0,
    matchClockDisplayMode: 'up',
    matchCountdownLengthMs: 14 * 60 * 1000,
    periodClockDisplayMode: 'up',
    periodCountdownLengthMs: 7 * 60 * 1000,
    gameClockRunning: false,
    gameAnchorWallMs: 0,
    gameElapsedMs: 0,
    ...over,
  };
}

describe('matchClock', () => {
  it('adds running segment to display', () => {
    const s = baseSession({
      clockRunning: true,
      anchorWallMs: 1000,
      elapsedMsInCurrentPeriod: 5000,
    });
    expect(currentPeriodElapsedDisplayMs(s, 4000)).toBe(5000 + (4000 - 1000));
  });

  it('pauses into elapsed', () => {
    const s = baseSession({
      clockRunning: true,
      anchorWallMs: 10_000,
      elapsedMsInCurrentPeriod: 0,
    });
    const p = pauseSession(s, 70_000);
    expect(p.clockRunning).toBe(false);
    expect(p.elapsedMsInCurrentPeriod).toBe(60_000);
  });

  it('advances to second half with P1 stored', () => {
    const s = baseSession({ elapsedMsInCurrentPeriod: 120_000 });
    const next = advanceToSecondHalf(s, Date.now());
    expect(next.period).toBe(2);
    expect(next.completedMsP1).toBe(120_000);
    expect(next.elapsedMsInCurrentPeriod).toBe(0);
  });

  it('adjustCurrentPeriod applies delta when paused', () => {
    const s = baseSession({ elapsedMsInCurrentPeriod: 60_000 });
    const a = adjustCurrentPeriod(s, 0, -30_000);
    expect(a.elapsedMsInCurrentPeriod).toBe(30_000);
  });

  it('adjustCurrentPeriod clamps at zero', () => {
    const s = baseSession({ elapsedMsInCurrentPeriod: 10_000 });
    const a = adjustCurrentPeriod(s, 0, -60_000);
    expect(a.elapsedMsInCurrentPeriod).toBe(0);
  });

  it('adjustCurrentPeriod keeps clock running when nudging live time', () => {
    const s = baseSession({
      clockRunning: true,
      anchorWallMs: 10_000,
      elapsedMsInCurrentPeriod: 50_000,
    });
    const a = adjustCurrentPeriod(s, 25_000, 5_000);
    expect(a.clockRunning).toBe(true);
    expect(a.anchorWallMs).toBe(25_000);
    expect(a.elapsedMsInCurrentPeriod).toBe(70_000);
    expect(currentPeriodElapsedDisplayMs(a, 30_000)).toBe(75_000);
  });

  it('formatClock renders m:ss', () => {
    expect(formatClock(7 * 60 * 1000)).toBe('7:00');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(-90_000)).toBe('-1:30');
    expect(formatClock(-59_000)).toBe('-0:59');
  });

  it('resume sets anchor', () => {
    const s = baseSession({ clockRunning: false });
    const r = resumeSession(s, 5_000);
    expect(r.clockRunning).toBe(true);
    expect(r.anchorWallMs).toBe(5_000);
  });

  it('cumulativeMatchTimeMs in P1 matches current period display', () => {
    const s = baseSession({
      period: 1,
      clockRunning: true,
      anchorWallMs: 1000,
      elapsedMsInCurrentPeriod: 60_000,
    });
    expect(cumulativeMatchTimeMs(s, 4000)).toBe(currentPeriodElapsedDisplayMs(s, 4000));
  });

  it('cumulativeMatchTimeMs in P2 adds completed P1', () => {
    const s = baseSession({
      period: 2,
      clockRunning: false,
      cumulativeMsBeforeCurrentPeriod: 420_000,
      completedMsP1: 420_000,
      elapsedMsInCurrentPeriod: 30_000,
    });
    expect(cumulativeMatchTimeMs(s, 0)).toBe(420_000 + 30_000);
  });

  it('advancePeriod wraps at max period to 1', () => {
    const s = baseSession({
      period: 99,
      elapsedMsInCurrentPeriod: 60_000,
      cumulativeMsBeforeCurrentPeriod: 500_000,
    });
    const next = advancePeriod(s, 0);
    expect(next.period).toBe(1);
    expect(next.cumulativeMsBeforeCurrentPeriod).toBe(560_000);
    expect(next.elapsedMsInCurrentPeriod).toBe(0);
  });

  it('shouldBlinkMatchThreshold at 7:00 in period 1', () => {
    const s = baseSession({
      period: 1,
      elapsedMsInCurrentPeriod: 7 * 60 * 1000,
    });
    expect(shouldBlinkMatchThreshold(s, 0)).toBe(true);
  });

  it('shouldBlinkMatchThreshold at 14:00 cumulative from period 2', () => {
    const s = baseSession({
      period: 2,
      cumulativeMsBeforeCurrentPeriod: 10 * 60 * 1000,
      elapsedMsInCurrentPeriod: 4 * 60 * 1000,
    });
    expect(shouldBlinkMatchThreshold(s, 0)).toBe(true);
  });

  it('parseMmSsToMs parses m:ss', () => {
    expect(parseMmSsToMs('7:00')).toBe(7 * 60 * 1000);
    expect(parseMmSsToMs('0:05')).toBe(5000);
    expect(parseMmSsToMs('-1:30')).toBe(-90_000);
    expect(parseMmSsToMs('bad')).toBeNull();
  });

  it('parseMmSsToMs accepts digits-only for numeric keyboards', () => {
    expect(parseMmSsToMs('48')).toBe(48_000);
    expect(parseMmSsToMs('1048')).toBe(10 * 60 * 1000 + 48_000);
    expect(parseMmSsToMs('-130')).toBe(-90_000);
  });

  it('normalizeMmSsInput formats digits as m:ss', () => {
    expect(normalizeMmSsInput('48')).toBe('0:48');
    expect(normalizeMmSsInput('1048')).toBe('10:48');
    expect(normalizeMmSsInput('12:34')).toBe('12:34');
    expect(normalizeMmSsInput('-130')).toBe('-1:30');
  });

  it('currentPeriodDisplayForUi shows remaining when countdown', () => {
    const s = baseSession({
      periodClockDisplayMode: 'down',
      periodCountdownLengthMs: 10 * 60 * 1000,
      elapsedMsInCurrentPeriod: 3 * 60 * 1000,
    });
    expect(currentPeriodDisplayForUi(s, 0)).toBe(7 * 60 * 1000);
  });

  it('currentMatchDisplayForUi shows remaining when match countdown', () => {
    const s = baseSession({
      matchClockDisplayMode: 'down',
      matchCountdownLengthMs: 20 * 60 * 1000,
      elapsedMsInCurrentPeriod: 5 * 60 * 1000,
    });
    expect(currentMatchDisplayForUi(s, 0)).toBe(15 * 60 * 1000);
  });

  it('currentPeriodDisplayForUi shows negative remaining in overtime', () => {
    const s = baseSession({
      periodClockDisplayMode: 'down',
      periodCountdownLengthMs: 10 * 60 * 1000,
      elapsedMsInCurrentPeriod: 10 * 60 * 1000 + 60_000,
    });
    expect(currentPeriodDisplayForUi(s, 0)).toBe(-60_000);
  });

  it('setPeriodFromDisplayedMs maps remaining to elapsed when down', () => {
    const s = baseSession({
      periodClockDisplayMode: 'down',
      periodCountdownLengthMs: 10 * 60 * 1000,
      elapsedMsInCurrentPeriod: 0,
    });
    const next = setPeriodFromDisplayedMs(s, 5 * 60 * 1000);
    expect(next.elapsedMsInCurrentPeriod).toBe(5 * 60 * 1000);
  });

  it('setPeriodFromDisplayedMs accepts negative remaining (overtime)', () => {
    const s = baseSession({
      periodClockDisplayMode: 'down',
      periodCountdownLengthMs: 7 * 60 * 1000,
      elapsedMsInCurrentPeriod: 0,
    });
    const next = setPeriodFromDisplayedMs(s, -2 * 60 * 1000);
    expect(next.elapsedMsInCurrentPeriod).toBe(9 * 60 * 1000);
  });

  it('film clock adds running segment', () => {
    const s = baseSession({
      gameClockRunning: true,
      gameAnchorWallMs: 1000,
      gameElapsedMs: 5000,
    });
    expect(currentGameElapsedDisplayMs(s, 4000)).toBe(5000 + (4000 - 1000));
  });

  it('adjustGameElapsed clamps at zero', () => {
    const s = baseSession({ gameElapsedMs: 10_000 });
    const a = adjustGameElapsed(s, 0, -60_000);
    expect(a.gameElapsedMs).toBe(0);
  });

  it('pauseGameSession folds elapsed', () => {
    const s = baseSession({
      gameClockRunning: true,
      gameAnchorWallMs: 10_000,
      gameElapsedMs: 0,
    });
    const p = pauseGameSession(s, 70_000);
    expect(p.gameClockRunning).toBe(false);
    expect(p.gameElapsedMs).toBe(60_000);
  });

  it('formatEventTimeWithFilm adds footage time in parentheses when film sync is set', () => {
    const s = baseSession({ filmTimeOffsetMs: 48_000 });
    expect(formatEventTimeWithFilm(s, { period: 1, matchTimeMs: 16_000 })).toEqual({
      match: 'P1 0:16',
      film: '1:04',
    });
    expect(formatEventTimeWithFilm(null, { period: 1, matchTimeMs: 16_000 })).toEqual({
      match: 'P1 0:16',
      film: null,
    });
    expect(formatEventTimeWithFilm(baseSession(), { period: 1, matchTimeMs: 16_000 })).toEqual({
      match: 'P1 0:16',
      film: null,
    });
  });

  it('filmTimeForDisplay adds session offset for video scrubbing', () => {
    expect(filmTimeForDisplay(60_000, 48_000)).toBe(108_000);
    expect(formatFilmClock(60_000, 48_000)).toBe('1:48');
    expect(formatFilmClock(undefined, 48_000)).toBeNull();
  });

  it('videoTimeDisplayMs uses match elapsed plus offset', () => {
    const s = baseSession({ filmTimeOffsetMs: 48_000, elapsedMsInCurrentPeriod: 90_000 });
    expect(videoTimeDisplayMs(s, 0)).toBe(138_000);
  });

  it('exitHalfTime banks footage gap for video sync', () => {
    const s = baseSession({
      halfTimeActive: true,
      halfTimeStartedWallMs: 1_000,
      elapsedMsInCurrentPeriod: 7 * 60 * 1000,
      filmTimeOffsetMs: 48_000,
    });
    const resumed = exitHalfTime(s, 121_000);
    expect(resumed.halfTimeActive).toBe(false);
    expect(resumed.filmFootageGaps).toEqual([{ afterMatchMs: 7 * 60 * 1000, gapMs: 120_000 }]);
    expect(footageGapBeforeMatchMs(resumed, 8 * 60 * 1000)).toBe(120_000);
    expect(videoTimeDisplayMs(resumed, 0)).toBe(7 * 60 * 1000 + 48_000 + 120_000);
    expect(footageGapBeforeMatchMs(resumed, 6 * 60 * 1000)).toBe(0);
  });

  it('enterRefStoppage pauses match clock and advances video time via wall clock', () => {
    const running = baseSession({
      clockRunning: true,
      anchorWallMs: 0,
      elapsedMsInCurrentPeriod: 60_000,
      filmTimeOffsetMs: 48_000,
    });
    const stopped = enterRefStoppage(running, 90_000);
    expect(stopped.clockRunning).toBe(false);
    expect(stopped.elapsedMsInCurrentPeriod).toBe(150_000);
    expect(stopped.refStoppageActive).toBe(true);
    expect(stopped.refStoppageResumeClock).toBe(true);
    expect(stopped.refStoppageStartedWallMs).toBe(90_000);
    expect(cumulativeMatchTimeMs(stopped, 120_000)).toBe(150_000);
    expect(videoTimeDisplayMs(stopped, 120_000)).toBe(150_000 + 48_000 + 30_000);
    expect(refStoppageElapsedDisplayMs(stopped, 120_000)).toBe(30_000);
  });

  it('exitRefStoppage banks footage gap for video sync', () => {
    const s = baseSession({
      refStoppageActive: true,
      refStoppageStartedWallMs: 1_000,
      elapsedMsInCurrentPeriod: 5 * 60 * 1000,
      filmTimeOffsetMs: 48_000,
    });
    const cleared = exitRefStoppage(s, 61_000);
    expect(cleared.refStoppageActive).toBe(false);
    expect(cleared.filmFootageGaps).toEqual([{ afterMatchMs: 5 * 60 * 1000, gapMs: 60_000 }]);
    expect(videoTimeDisplayMs(cleared, 0)).toBe(5 * 60 * 1000 + 48_000 + 60_000);
  });

  it('applyFilmSyncToSession updates video time without changing match elapsed', () => {
    const s = baseSession({
      period: 2,
      cumulativeMsBeforeCurrentPeriod: 7 * 60 * 1000,
      elapsedMsInCurrentPeriod: 0,
      filmTimeOffsetMs: 48_000,
      filmFootageGaps: [{ afterMatchMs: 7 * 60 * 1000, gapMs: 120_000 }],
    });
    const synced = applyFilmSyncToSession(s, 0, 48_000, 10 * 60 * 1000 + 14_000);
    expect(cumulativeMatchTimeMs(synced, 0)).toBe(7 * 60 * 1000);
    expect(synced.filmFootageGaps).toEqual([{ afterMatchMs: 7 * 60 * 1000, gapMs: 146_000 }]);
    expect(videoTimeDisplayMs(synced, 0)).toBe(10 * 60 * 1000 + 14_000);
  });

  it('clockDisplayMatchesSession detects unchanged match and period fields', () => {
    const s = baseSession({
      period: 2,
      cumulativeMsBeforeCurrentPeriod: 7 * 60 * 1000,
      elapsedMsInCurrentPeriod: 0,
    });
    const payload = {
      period: 2,
      matchClockDisplayMode: 'up' as const,
      matchCountdownLengthMs: 14 * 60 * 1000,
      periodClockDisplayMode: 'up' as const,
      periodCountdownLengthMs: 7 * 60 * 1000,
      matchDisplayedMs: 7 * 60 * 1000,
      periodDisplayedMs: 0,
    };
    expect(clockDisplayMatchesSession(s, 0, payload)).toBe(true);
    expect(clockDisplayMatchesSession(s, 0, { ...payload, matchDisplayedMs: 0 })).toBe(false);
  });

  it('syncSessionVideoTimeNow adjusts kickoff offset in first half', () => {
    const s = baseSession({ filmTimeOffsetMs: 48_000, elapsedMsInCurrentPeriod: 90_000 });
    const synced = syncSessionVideoTimeNow(s, 0, 143_000);
    expect(synced.filmTimeOffsetMs).toBe(53_000);
    expect(videoTimeDisplayMs(synced, 0)).toBe(143_000);
  });

  it('syncSessionVideoTimeNow adjusts banked halftime gap in second half', () => {
    const s = baseSession({
      filmTimeOffsetMs: 48_000,
      elapsedMsInCurrentPeriod: 60_000,
      cumulativeMsBeforeCurrentPeriod: 7 * 60 * 1000,
      filmFootageGaps: [{ afterMatchMs: 7 * 60 * 1000, gapMs: 120_000 }],
    });
    const synced = syncSessionVideoTimeNow(s, 0, 8 * 60 * 1000 + 48_000 + 125_000);
    expect(synced.filmTimeOffsetMs).toBe(48_000);
    expect(synced.filmFootageGaps).toEqual([{ afterMatchMs: 7 * 60 * 1000, gapMs: 125_000 }]);
    expect(videoTimeDisplayMs(synced, 0)).toBe(8 * 60 * 1000 + 48_000 + 125_000);
  });

  it('syncSessionVideoTimeNow shifts halftime wall anchor while HT is active', () => {
    const s = baseSession({
      halfTimeActive: true,
      halfTimeStartedWallMs: 1_000,
      elapsedMsInCurrentPeriod: 7 * 60 * 1000,
      filmTimeOffsetMs: 48_000,
    });
    const synced = syncSessionVideoTimeNow(s, 61_000, 7 * 60 * 1000 + 48_000 + 55_000);
    expect(synced.halfTimeStartedWallMs).toBe(6_000);
    expect(videoTimeDisplayMs(synced, 61_000)).toBe(7 * 60 * 1000 + 48_000 + 55_000);
  });

  it('videoTimeDisplayMs includes in-progress halftime wall time', () => {
    const s = baseSession({
      halfTimeActive: true,
      halfTimeStartedWallMs: 1_000,
      elapsedMsInCurrentPeriod: 7 * 60 * 1000,
      filmTimeOffsetMs: 48_000,
    });
    expect(videoTimeDisplayMs(s, 61_000)).toBe(7 * 60 * 1000 + 48_000 + 60_000);
  });

  it('resumeGameSession sets game anchor', () => {
    const s = baseSession({ gameClockRunning: false });
    const r = resumeGameSession(s, 5_000);
    expect(r.gameClockRunning).toBe(true);
    expect(r.gameAnchorWallMs).toBe(5_000);
  });

  it('enterMatchComplete pauses clocks and clears halftime', () => {
    const s = baseSession({
      clockRunning: true,
      anchorWallMs: 1000,
      halfTimeActive: true,
      halfTimeStartedWallMs: 500,
      gameClockRunning: true,
      gameAnchorWallMs: 1000,
    });
    const next = enterMatchComplete(s, 10_000);
    expect(next.matchComplete).toBe(true);
    expect(next.clockRunning).toBe(false);
    expect(next.gameClockRunning).toBe(false);
    expect(next.halfTimeActive).toBe(false);
  });

  it('exitMatchComplete clears flag', () => {
    const s = baseSession({ matchComplete: true, matchCompleteWallMs: 99 });
    const next = exitMatchComplete(s);
    expect(next.matchComplete).toBe(false);
    expect(next.matchCompleteWallMs).toBeUndefined();
  });
});
