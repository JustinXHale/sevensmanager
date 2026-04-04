import { describe, expect, it } from 'vitest';
import type { MatchEventRecord } from './matchEvent';
import {
  buildPlayerProfiles,
  buildZoneHeatRows,
  negativeActionBreakdown,
  penaltyCountByType,
  playerInvolvement,
  ruckSpeedByPeriod,
  ruckSpeedDistribution,
  ruckSpeedMedianMs,
  scoringTimeline,
  setPieceByPhase,
  tempoByPeriod,
} from './matchAnalyticsDeep';

function ev(over: Partial<MatchEventRecord> & Pick<MatchEventRecord, 'id' | 'kind'>): MatchEventRecord {
  return {
    matchId: 'm1',
    matchTimeMs: 0,
    period: 1,
    createdAt: 0,
    ...over,
  } as MatchEventRecord;
}

describe('buildZoneHeatRows', () => {
  it('groups events by zone and kind', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'pass', zoneId: 'Z1' }),
      ev({ id: '2', kind: 'pass', zoneId: 'Z3' }),
      ev({ id: '3', kind: 'pass', zoneId: 'Z1' }),
      ev({ id: '4', kind: 'tackle', tackleOutcome: 'made', zoneId: 'Z2' }),
      ev({ id: '5', kind: 'tackle', tackleOutcome: 'missed', zoneId: 'Z2' }),
    ];
    const rows = buildZoneHeatRows(events);
    const passes = rows.find((r) => r.kind === 'pass');
    expect(passes).toBeDefined();
    expect(passes!.zones.Z1).toBe(2);
    expect(passes!.zones.Z3).toBe(1);
    expect(passes!.total).toBe(3);

    const madeRow = rows.find((r) => r.kind === 'tackle_made');
    expect(madeRow!.zones.Z2).toBe(1);
    const missedRow = rows.find((r) => r.kind === 'tackle_missed');
    expect(missedRow!.zones.Z2).toBe(1);
  });

  it('filters out deleted events', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'pass', zoneId: 'Z1' }),
      ev({ id: '2', kind: 'pass', zoneId: 'Z1', deletedAt: Date.now() }),
    ];
    const rows = buildZoneHeatRows(events);
    expect(rows[0]!.total).toBe(1);
  });

  it('omits rows with zero total', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'try', playerId: 'a' }),
    ];
    const rows = buildZoneHeatRows(events);
    expect(rows.length).toBe(0);
  });
});

describe('buildPlayerProfiles', () => {
  it('aggregates per-player stats', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'pass', playerId: 'p1', zoneId: 'Z1' }),
      ev({ id: '2', kind: 'pass', playerId: 'p1', passVariant: 'offload', zoneId: 'Z2' }),
      ev({ id: '3', kind: 'tackle', playerId: 'p1', tackleOutcome: 'made', tackleQuality: 'dominant' }),
      ev({ id: '4', kind: 'tackle', playerId: 'p1', tackleOutcome: 'missed' }),
      ev({ id: '5', kind: 'try', playerId: 'p1' }),
      ev({ id: '6', kind: 'negative_action', playerId: 'p1', negativeActionId: 'knock_on' }),
      ev({ id: '7', kind: 'team_penalty', playerId: 'p1', penaltyCard: 'yellow' }),
      ev({ id: '8', kind: 'pass', playerId: 'p2', zoneId: 'Z3' }),
    ];
    const m = buildPlayerProfiles(events);
    expect(m.size).toBe(2);
    const p1 = m.get('p1')!;
    expect(p1.passes).toBe(2);
    expect(p1.offloads).toBe(1);
    expect(p1.tackles.made).toBe(1);
    expect(p1.tackles.missed).toBe(1);
    expect(p1.tackles.dominant).toBe(1);
    expect(p1.tries).toBe(1);
    expect(p1.negatives).toBe(1);
    expect(p1.negativeBreakdown.knock_on).toBe(1);
    expect(p1.penalties).toBe(1);
    expect(p1.cards.yellow).toBe(1);
  });

  it('ignores deleted events', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'pass', playerId: 'p1', deletedAt: Date.now() }),
    ];
    const m = buildPlayerProfiles(events);
    expect(m.size).toBe(0);
  });
});

describe('playerInvolvement', () => {
  it('sums key actions', () => {
    const p = buildPlayerProfiles([
      ev({ id: '1', kind: 'pass', playerId: 'p1' }),
      ev({ id: '2', kind: 'tackle', playerId: 'p1', tackleOutcome: 'made' }),
      ev({ id: '3', kind: 'try', playerId: 'p1' }),
    ]).get('p1')!;
    expect(playerInvolvement(p)).toBe(3);
  });
});

describe('penaltyCountByType', () => {
  it('counts and sorts descending', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'team_penalty', playerId: 'a', penaltyType: 'offside' }),
      ev({ id: '2', kind: 'team_penalty', playerId: 'a', penaltyType: 'high_tackle' }),
      ev({ id: '3', kind: 'team_penalty', playerId: 'b', penaltyType: 'offside' }),
    ];
    const rows = penaltyCountByType(events);
    expect(rows[0]!.type).toBe('offside');
    expect(rows[0]!.count).toBe(2);
    expect(rows[1]!.type).toBe('high_tackle');
    expect(rows[1]!.count).toBe(1);
  });
});

describe('ruckSpeedMedianMs', () => {
  it('returns null for empty', () => {
    expect(ruckSpeedMedianMs([])).toBeNull();
  });

  it('returns median of odd length', () => {
    expect(ruckSpeedMedianMs([3000, 1000, 2000])).toBe(2000);
  });

  it('averages middle pair for even length', () => {
    expect(ruckSpeedMedianMs([1000, 2000, 3000, 4000])).toBe(2500);
  });
});

describe('ruckSpeedDistribution', () => {
  it('buckets durations', () => {
    const durations = [500, 1500, 2500, 3500, 5000, 7000, 9000];
    const buckets = ruckSpeedDistribution(durations);
    expect(buckets[0]!.count).toBe(2); // < 2s
    expect(buckets[1]!.count).toBe(2); // 2-4s
    expect(buckets[2]!.count).toBe(1); // 4-6s
    expect(buckets[3]!.count).toBe(1); // 6-8s
    expect(buckets[4]!.count).toBe(1); // 8s+
  });
});

describe('ruckSpeedByPeriod', () => {
  it('averages ruck-to-pass per period', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'ruck', matchTimeMs: 10000, period: 1 }),
      ev({ id: '2', kind: 'pass', matchTimeMs: 13000, period: 1, playerId: 'p1' }),
      ev({ id: '3', kind: 'ruck', matchTimeMs: 20000, period: 1 }),
      ev({ id: '4', kind: 'pass', matchTimeMs: 25000, period: 1, playerId: 'p1' }),
      ev({ id: '5', kind: 'ruck', matchTimeMs: 1000, period: 2 }),
      ev({ id: '6', kind: 'pass', matchTimeMs: 3000, period: 2, playerId: 'p1' }),
    ];
    const result = ruckSpeedByPeriod(events);
    expect(result).toHaveLength(2);
    expect(result[0]!.period).toBe(1);
    expect(result[0]!.avgMs).toBe(4000);
    expect(result[0]!.count).toBe(2);
    expect(result[1]!.period).toBe(2);
    expect(result[1]!.avgMs).toBe(2000);
  });
});

describe('setPieceByPhase', () => {
  it('splits scrums by attack/defense', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'scrum', setPieceOutcome: 'won', playPhaseContext: 'attack' }),
      ev({ id: '2', kind: 'scrum', setPieceOutcome: 'lost', playPhaseContext: 'defense' }),
      ev({ id: '3', kind: 'scrum', setPieceOutcome: 'won', playPhaseContext: 'defense' }),
    ];
    const r = setPieceByPhase(events, 'scrum');
    expect(r.attack.won).toBe(1);
    expect(r.defense.lost).toBe(1);
    expect(r.defense.won).toBe(1);
  });
});

describe('negativeActionBreakdown', () => {
  it('counts and labels', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'negative_action', playerId: 'a', negativeActionId: 'knock_on' }),
      ev({ id: '2', kind: 'negative_action', playerId: 'a', negativeActionId: 'knock_on' }),
      ev({ id: '3', kind: 'negative_action', playerId: 'b', negativeActionId: 'bad_pass' }),
    ];
    const rows = negativeActionBreakdown(events);
    expect(rows[0]!.id).toBe('knock_on');
    expect(rows[0]!.count).toBe(2);
    expect(rows[1]!.id).toBe('bad_pass');
  });
});

describe('tempoByPeriod', () => {
  it('reports events per minute', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'pass', matchTimeMs: 0, period: 1 }),
      ev({ id: '2', kind: 'tackle', matchTimeMs: 60000, period: 1, tackleOutcome: 'made' }),
      ev({ id: '3', kind: 'pass', matchTimeMs: 120000, period: 1 }),
    ];
    const t = tempoByPeriod(events);
    expect(t).toHaveLength(1);
    expect(t[0]!.events).toBe(3);
    expect(t[0]!.perMinute).toBe(1.5);
  });
});

describe('scoringTimeline', () => {
  it('tracks running totals', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'try', matchTimeMs: 10000, period: 1, playerId: 'a' }),
      ev({ id: '2', kind: 'conversion', matchTimeMs: 11000, period: 1, playerId: 'a', conversionOutcome: 'made' }),
      ev({ id: '3', kind: 'opponent_try', matchTimeMs: 40000, period: 1 }),
    ];
    const tl = scoringTimeline(events);
    expect(tl).toHaveLength(3);
    expect(tl[0]!.runningUs).toBe(5);
    expect(tl[0]!.runningOpp).toBe(0);
    expect(tl[1]!.runningUs).toBe(7);
    expect(tl[2]!.runningOpp).toBe(5);
  });

  it('ignores deleted events', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'try', matchTimeMs: 10000, period: 1, playerId: 'a', deletedAt: Date.now() }),
    ];
    expect(scoringTimeline(events)).toHaveLength(0);
  });
});
