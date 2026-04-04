import { describe, expect, it } from 'vitest';
import type { MatchSessionRecord } from '@/domain/match';
import type { PlayerRecord } from '@/domain/player';
import { flushPlayerMinutes } from '@/domain/playerMinutes';

function sess(over: Partial<MatchSessionRecord> = {}): MatchSessionRecord {
  return {
    matchId: 'm1',
    period: 1,
    clockRunning: true,
    anchorWallMs: 10_000,
    elapsedMsInCurrentPeriod: 60_000,
    cumulativeMsBeforeCurrentPeriod: 0,
    matchClockDisplayMode: 'up',
    matchCountdownLengthMs: 14 * 60 * 1000,
    periodClockDisplayMode: 'up',
    periodCountdownLengthMs: 7 * 60 * 1000,
    completedMsP1: 0,
    completedMsP2: 0,
    gameClockRunning: false,
    gameAnchorWallMs: 0,
    gameElapsedMs: 0,
    playerMinutesMs: {},
    minutesLedgerMatchMs: 60_000,
    ...over,
  };
}

function pl(id: string, status: PlayerRecord['status']): PlayerRecord {
  return {
    id,
    matchId: 'm1',
    name: '',
    number: 1,
    status,
    createdAt: 0,
  };
}

describe('flushPlayerMinutes', () => {
  it('adds pending delta to on-field players only', () => {
    const session = sess({
      minutesLedgerMatchMs: 60_000,
      playerMinutesMs: { a: 1000 },
    });
    const players = [pl('a', 'on'), pl('b', 'bench')];
    const next = flushPlayerMinutes(session, players, 11_000);
    expect(next.minutesLedgerMatchMs).toBe(61_000);
    expect(next.playerMinutesMs?.a).toBe(2000);
    expect(next.playerMinutesMs?.b).toBeUndefined();
  });
});
