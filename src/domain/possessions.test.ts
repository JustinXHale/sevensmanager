import { describe, expect, it } from 'vitest';
import type { MatchEventRecord } from './matchEvent';
import { computePossessionStats } from './possessions';

function ev(over: Partial<MatchEventRecord> & Pick<MatchEventRecord, 'id' | 'kind'>): MatchEventRecord {
  return {
    matchId: 'm1',
    matchTimeMs: 0,
    period: 1,
    createdAt: 0,
    ...over,
  } as MatchEventRecord;
}

describe('computePossessionStats', () => {
  it('counts one possession ending at conversion after try', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'restart', matchTimeMs: 0, playPhaseContext: 'attack', setPieceOutcome: 'won' }),
      ev({ id: '2', kind: 'pass', matchTimeMs: 5000, playerId: 'a' }),
      ev({ id: '3', kind: 'pass', matchTimeMs: 8000, playerId: 'b' }),
      ev({ id: '4', kind: 'try', matchTimeMs: 12000, playerId: 'b' }),
      ev({ id: '5', kind: 'conversion', matchTimeMs: 45000, conversionOutcome: 'made', playerId: 'b' }),
    ];
    const s = computePossessionStats(events);
    expect(s.us).toBe(1);
    expect(s.opp).toBe(0);
    expect(s.total).toBe(1);
    expect(s.passesPerPossessionUs).toBe(2);
  });

  it('ends possession on knock-on after long pass chain', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'restart', matchTimeMs: 0, playPhaseContext: 'attack', setPieceOutcome: 'won' }),
      ev({ id: '2', kind: 'pass', matchTimeMs: 1000, playerId: 'a' }),
      ev({ id: '3', kind: 'pass', matchTimeMs: 2000, playerId: 'a' }),
      ev({ id: '4', kind: 'negative_action', matchTimeMs: 3000, negativeActionId: 'knock_on' }),
    ];
    const s = computePossessionStats(events);
    expect(s.us).toBe(1);
    expect(s.passesPerPossessionUs).toBe(2);
  });

  it('starts new possession on restart after conversion', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'restart', matchTimeMs: 0, playPhaseContext: 'attack', setPieceOutcome: 'won' }),
      ev({ id: '2', kind: 'try', matchTimeMs: 10000, playerId: 'a' }),
      ev({ id: '3', kind: 'conversion', matchTimeMs: 40000, conversionOutcome: 'made', playerId: 'a' }),
      ev({ id: '4', kind: 'restart', matchTimeMs: 70000, playPhaseContext: 'attack', setPieceOutcome: 'won' }),
      ev({ id: '5', kind: 'pass', matchTimeMs: 75000, playerId: 'a' }),
      ev({ id: '6', kind: 'negative_action', matchTimeMs: 80000, negativeActionId: 'knock_on' }),
    ];
    const s = computePossessionStats(events);
    expect(s.us).toBe(2);
    expect(s.total).toBe(2);
  });

  it('counts opponent possession through try and conversion', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'restart', matchTimeMs: 0, playPhaseContext: 'attack', setPieceOutcome: 'lost' }),
      ev({ id: '2', kind: 'pass', matchTimeMs: 5000, playPhaseContext: 'defense' }),
      ev({ id: '3', kind: 'opponent_try', matchTimeMs: 30000 }),
      ev({ id: '4', kind: 'opponent_conversion', matchTimeMs: 55000, conversionOutcome: 'made' }),
    ];
    const s = computePossessionStats(events);
    expect(s.opp).toBe(1);
    expect(s.us).toBe(0);
  });

  it('forced turnover starts our possession', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'pass', matchTimeMs: 0, playPhaseContext: 'defense' }),
      ev({ id: '2', kind: 'forced_turnover', matchTimeMs: 5000 }),
      ev({ id: '3', kind: 'pass', matchTimeMs: 6000, playerId: 'a' }),
      ev({ id: '4', kind: 'negative_action', matchTimeMs: 9000, negativeActionId: 'knock_on' }),
    ];
    const s = computePossessionStats(events);
    expect(s.opp).toBe(1);
    expect(s.us).toBe(1);
    expect(s.total).toBe(2);
  });
});
