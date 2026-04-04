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
  formatClock,
  parseMmSsToMs,
  pauseGameSession,
  pauseSession,
  resumeGameSession,
  resumeSession,
  setPeriodFromDisplayedMs,
  shouldBlinkMatchThreshold,
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

  it('resumeGameSession sets game anchor', () => {
    const s = baseSession({ gameClockRunning: false });
    const r = resumeGameSession(s, 5_000);
    expect(r.gameClockRunning).toBe(true);
    expect(r.gameAnchorWallMs).toBe(5_000);
  });
});
