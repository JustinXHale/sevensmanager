import { describe, expect, it } from 'vitest';
import type { MatchEventRecord } from './matchEvent';
import { isDeadTimeGap, phaseTimeSplit } from './matchAnalyticsDeep';
import { computeInferredMatchStats, computeRuckBreakdownByPhase, passChainLengths } from './inferredStats';

function ev(over: Partial<MatchEventRecord> & Pick<MatchEventRecord, 'id' | 'kind'>): MatchEventRecord {
  return {
    matchId: 'm1',
    matchTimeMs: 0,
    period: 1,
    createdAt: 0,
    ...over,
  } as MatchEventRecord;
}

describe('isDeadTimeGap', () => {
  it('flags try to conversion and conversion to restart', () => {
    expect(isDeadTimeGap(ev({ id: '1', kind: 'try' }), ev({ id: '2', kind: 'conversion' }))).toBe(true);
    expect(isDeadTimeGap(ev({ id: '3', kind: 'conversion' }), ev({ id: '4', kind: 'restart' }))).toBe(true);
    expect(isDeadTimeGap(ev({ id: '5', kind: 'pass' }), ev({ id: '6', kind: 'pass' }))).toBe(false);
  });
});

describe('phaseTimeSplit dead time', () => {
  it('excludes try-conversion and conversion-restart gaps', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'pass', matchTimeMs: 0, playerId: 'a' }),
      ev({ id: '2', kind: 'try', matchTimeMs: 10_000, playerId: 'a' }),
      ev({ id: '3', kind: 'conversion', matchTimeMs: 40_000, conversionOutcome: 'made' }),
      ev({ id: '4', kind: 'restart', matchTimeMs: 70_000, playPhaseContext: 'defense' }),
      ev({ id: '5', kind: 'tackle', matchTimeMs: 80_000, tackleOutcome: 'made' }),
    ];
    const pt = phaseTimeSplit(events)!;
    expect(pt.deadTimeMs).toBe(60_000);
    expect(pt.offenseMs).toBe(10_000);
    expect(pt.defenseMs).toBe(10_000);
    expect(pt.playingTimeMs).toBe(20_000);
  });
});

describe('passChainLengths', () => {
  it('splits on non-pass events', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'pass', matchTimeMs: 0, playerId: 'a' }),
      ev({ id: '2', kind: 'pass', matchTimeMs: 1000, playerId: 'b' }),
      ev({ id: '3', kind: 'line_break', matchTimeMs: 2000, playerId: 'b' }),
      ev({ id: '4', kind: 'pass', matchTimeMs: 3000, playerId: 'c' }),
    ];
    expect(passChainLengths(events)).toEqual([2, 1]);
  });
});

describe('computeRuckBreakdownByPhase', () => {
  it('splits contest and outcomes by attack vs defense', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'ruck', playPhaseContext: 'attack', setPieceOutcome: 'won', ruckContest: 'contested' }),
      ev({ id: '2', kind: 'ruck', playPhaseContext: 'attack', setPieceOutcome: 'lost', ruckContest: 'uncontested' }),
      ev({ id: '3', kind: 'ruck', playPhaseContext: 'defense', setPieceOutcome: 'won', ruckContest: 'contested' }),
      ev({ id: '4', kind: 'ruck', playPhaseContext: 'defense', setPieceOutcome: 'lost' }),
    ];
    const b = computeRuckBreakdownByPhase(events);
    expect(b.attack).toMatchObject({ total: 2, contested: 1, uncontested: 1, won: 1, lost: 1, wonPct: 50 });
    expect(b.defense).toMatchObject({ total: 2, contested: 1, unknownContest: 1, won: 1, lost: 1, wonPct: 50 });
  });
});

describe('computeInferredMatchStats', () => {
  it('computes line break conversion and attack ruck won pct', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'line_break', playerId: 'a' }),
      ev({ id: '2', kind: 'line_break', playerId: 'b' }),
      ev({ id: '3', kind: 'try', playerId: 'a' }),
      ev({ id: '4', kind: 'ruck', playPhaseContext: 'attack', setPieceOutcome: 'won' }),
      ev({ id: '5', kind: 'ruck', playPhaseContext: 'attack', setPieceOutcome: 'lost' }),
    ];
    const s = computeInferredMatchStats(events);
    expect(s.lineBreakToTryPct).toBe(50);
    expect(s.attackRuckWonPct).toBe(50);
    expect(s.ruckByPhase.attack.total).toBe(2);
  });

  it('counts attack and defense passes separately', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'pass', playerId: 'a' }),
      ev({ id: '2', kind: 'pass', playerId: 'b', passVariant: 'offload' }),
      ev({ id: '3', kind: 'pass', playPhaseContext: 'defense' }),
      ev({ id: '4', kind: 'pass', playPhaseContext: 'defense' }),
    ];
    const s = computeInferredMatchStats(events);
    expect(s.attackPasses).toBe(1);
    expect(s.attackOffloads).toBe(1);
    expect(s.defensePasses).toBe(2);
  });

  it('counts possession swing after defense ruck won', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'ruck', matchTimeMs: 0, playPhaseContext: 'defense', setPieceOutcome: 'won' }),
      ev({ id: '2', kind: 'pass', matchTimeMs: 5000, playerId: 'a' }),
      ev({ id: '3', kind: 'ruck', matchTimeMs: 10_000, playPhaseContext: 'defense', setPieceOutcome: 'won' }),
      ev({ id: '4', kind: 'tackle', matchTimeMs: 12_000, tackleOutcome: 'made' }),
    ];
    const s = computeInferredMatchStats(events);
    expect(s.possessionSwings).toBe(1);
    expect(s.defenseRucksWon).toBe(2);
    expect(s.possessionSwingPct).toBe(50);
  });
});
