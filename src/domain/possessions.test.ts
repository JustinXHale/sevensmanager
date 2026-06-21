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
    expect(s.segments[0]?.endReason).toBe('conversion');
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

  it('counts failed restart receive as our possession then opponent spell', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'restart', matchTimeMs: 0, playPhaseContext: 'attack', setPieceOutcome: 'lost' }),
      ev({ id: '2', kind: 'pass', matchTimeMs: 5000, playPhaseContext: 'defense' }),
      ev({ id: '3', kind: 'opponent_try', matchTimeMs: 30000 }),
      ev({ id: '4', kind: 'opponent_conversion', matchTimeMs: 55000, conversionOutcome: 'made' }),
    ];
    const s = computePossessionStats(events);
    expect(s.us).toBe(1);
    expect(s.opp).toBe(1);
    expect(s.segments[0]).toMatchObject({ side: 'us', endReason: 'restart_receive_lost' });
    expect(s.segments[1]).toMatchObject({ side: 'opp', endReason: 'opponent_conversion' });
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

  it('does not split one attack spell on repeated restart wins', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'restart', matchTimeMs: 0, playPhaseContext: 'attack', setPieceOutcome: 'won' }),
      ev({ id: '2', kind: 'restart', matchTimeMs: 1000, playPhaseContext: 'attack', setPieceOutcome: 'won' }),
      ev({ id: '3', kind: 'pass', matchTimeMs: 2000, playerId: 'a' }),
      ev({ id: '4', kind: 'negative_action', matchTimeMs: 3000, negativeActionId: 'knock_on' }),
    ];
    const s = computePossessionStats(events);
    expect(s.us).toBe(1);
    expect(s.opp).toBe(0);
  });

  it('models scoring match with lost receives and try cycles', () => {
    const events: MatchEventRecord[] = [];
    let t = 0;
    let id = 0;
    const add = (kind: MatchEventRecord['kind'], extra: Partial<MatchEventRecord> = {}) => {
      events.push(ev({ id: String(id++), kind, matchTimeMs: t, ...extra }));
      t += 60_000;
    };

    // Opening receive won → try → conversion
    add('restart', { playPhaseContext: 'attack', setPieceOutcome: 'won' });
    add('pass', { playerId: 'a' });
    add('try', { playerId: 'a' });
    add('conversion', { conversionOutcome: 'made', playerId: 'a' });

    // Three failed receives (our giveaways)
    for (let i = 0; i < 3; i++) {
      add('restart', { playPhaseContext: 'attack', setPieceOutcome: 'lost' });
      add('pass', { playPhaseContext: 'defense' });
      add('ruck', { playPhaseContext: 'defense', setPieceOutcome: 'won' });
    }

    // Two opponent scoring possessions
    add('pass', { playPhaseContext: 'defense' });
    add('opponent_try');
    add('opponent_conversion', { conversionOutcome: 'made' });
    add('restart', { playPhaseContext: 'attack', setPieceOutcome: 'won' });
    add('pass', { playPhaseContext: 'defense' });
    add('opponent_try');
    add('opponent_conversion', { conversionOutcome: 'made' });

    const s = computePossessionStats(events);
    expect(s.us).toBeGreaterThanOrEqual(4); // 1 scoring + 3 failed receives
    expect(s.opp).toBeGreaterThanOrEqual(2); // at least 2 scoring spells
    expect(s.us).toBeGreaterThan(s.opp); // we scored more and lost more receives
    expect(s.total).toBe(s.us + s.opp);
    expect(s.segments.filter((x) => x.endReason === 'restart_receive_lost')).toHaveLength(3);
  });
});
