import { describe, expect, it } from 'vitest';
import type { MatchEventRecord } from './matchEvent';
import {
  countEventsByPeriod,
  eventHistogramByMatchTime,
  lastMatchingEventId,
  offloadToneBreakdown,
  rugbyPointsFromOpponentEvents,
  rugbyPointsFromOwnTeamEvents,
  ruckToFirstPassDurationsMs,
  triesByZone,
} from './matchStats';

function ev(over: Partial<MatchEventRecord> & Pick<MatchEventRecord, 'id' | 'kind'>): MatchEventRecord {
  return {
    matchId: 'm1',
    matchTimeMs: 0,
    period: 1,
    createdAt: 0,
    ...over,
  } as MatchEventRecord;
}

describe('lastMatchingEventId', () => {
  it('returns the latest active event by match clock', () => {
    const events: MatchEventRecord[] = [
      ev({ id: 'a', kind: 'opponent_substitution', matchTimeMs: 100, period: 1 }),
      ev({ id: 'b', kind: 'opponent_substitution', matchTimeMs: 500, period: 1 }),
      ev({ id: 'c', kind: 'opponent_substitution', matchTimeMs: 200, period: 1, deletedAt: 1 }),
    ];
    expect(lastMatchingEventId(events, (e) => e.kind === 'opponent_substitution')).toBe('b');
  });

  it('returns undefined when none match', () => {
    expect(lastMatchingEventId([], () => true)).toBeUndefined();
  });
});

describe('rugbyPointsFromOpponentEvents', () => {
  it('sums opponent tries and made conversions', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'opponent_try' }),
      ev({ id: '2', kind: 'opponent_conversion', conversionOutcome: 'made' }),
      ev({ id: '3', kind: 'opponent_conversion', conversionOutcome: 'missed' }),
    ];
    expect(rugbyPointsFromOpponentEvents(events)).toBe(5 + 2 + 0);
  });
});

describe('rugbyPointsFromOwnTeamEvents', () => {
  it('sums tries and made conversions; skips missed and deleted', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'try', playerId: 'a' }),
      ev({ id: '2', kind: 'conversion', playerId: 'a', conversionOutcome: 'made' }),
      ev({ id: '3', kind: 'try', playerId: 'b' }),
      ev({ id: '4', kind: 'conversion', playerId: 'b', conversionOutcome: 'missed' }),
      ev({ id: '5', kind: 'conversion', playerId: 'c' }),
      ev({ id: '6', kind: 'pass', playerId: 'd' }),
      ev({ id: '7', kind: 'try', playerId: 'e', deletedAt: 1 }),
    ];
    expect(rugbyPointsFromOwnTeamEvents(events)).toBe(5 + 2 + 5 + 0 + 2);
  });
});

describe('triesByZone', () => {
  it('counts tries with zoneId per zone only', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'try', playerId: 'a', zoneId: 'Z6' }),
      ev({ id: '2', kind: 'try', playerId: 'b', zoneId: 'Z6' }),
      ev({ id: '3', kind: 'try', playerId: 'c' }),
      ev({ id: '4', kind: 'pass', playerId: 'd', zoneId: 'Z3' }),
    ];
    const z = triesByZone(events);
    expect(z.Z6).toBe(2);
    expect(z.Z1).toBe(0);
    expect(z.Z3).toBe(0);
  });
});

describe('countEventsByPeriod', () => {
  it('aggregates by period and sorts', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'pass', period: 2 }),
      ev({ id: '2', kind: 'ruck', period: 1 }),
      ev({ id: '3', kind: 'pass', period: 1 }),
    ];
    expect(countEventsByPeriod(events)).toEqual([
      { period: 1, count: 2 },
      { period: 2, count: 1 },
    ]);
  });
});

describe('ruckToFirstPassDurationsMs', () => {
  it('pairs each ruck with next pass in same period only', () => {
    const events: MatchEventRecord[] = [
      ev({ id: 'r1', kind: 'ruck', matchTimeMs: 10_000, period: 1 }),
      ev({ id: 'p1', kind: 'pass', matchTimeMs: 25_000, period: 1, playerId: 'a' }),
      ev({ id: 'r2', kind: 'ruck', matchTimeMs: 30_000, period: 1 }),
      ev({ id: 'p2', kind: 'pass', matchTimeMs: 50_000, period: 1, playerId: 'b' }),
    ];
    expect(ruckToFirstPassDurationsMs(events)).toEqual([15_000, 20_000]);
  });

  it('does not pair across periods', () => {
    const events: MatchEventRecord[] = [
      ev({ id: 'r1', kind: 'ruck', matchTimeMs: 10_000, period: 1 }),
      ev({ id: 'p1', kind: 'pass', matchTimeMs: 20_000, period: 2, playerId: 'a' }),
    ];
    expect(ruckToFirstPassDurationsMs(events)).toEqual([]);
  });
});

describe('offloadToneBreakdown', () => {
  it('excludes standard passes from Neg/Neu/Pos counts', () => {
    const events: MatchEventRecord[] = [
      ev({
        id: '1',
        kind: 'pass',
        passVariant: 'standard',
        playerId: 'a',
      }),
      ev({
        id: '2',
        kind: 'pass',
        passVariant: 'offload',
        offloadTone: 'negative',
        playerId: 'b',
      }),
      ev({
        id: '3',
        kind: 'pass',
        offloadTone: 'positive',
        playerId: 'c',
      }),
    ];
    const o = offloadToneBreakdown(events);
    expect(o.negative).toBe(1);
    expect(o.positive).toBe(1);
    expect(o.neutral).toBe(0);
  });
});

describe('eventHistogramByMatchTime', () => {
  it('bins by time span', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'pass', matchTimeMs: 0 }),
      ev({ id: '2', kind: 'pass', matchTimeMs: 300_000 }),
      ev({ id: '3', kind: 'pass', matchTimeMs: 300_000 }),
    ];
    const { bins, maxMs } = eventHistogramByMatchTime(events, 4);
    expect(maxMs).toBe(300_000);
    expect(bins.length).toBe(4);
    expect(bins.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('puts all events at t=0 in first bin when maxMs is 0', () => {
    const events: MatchEventRecord[] = [ev({ id: '1', kind: 'pass', matchTimeMs: 0 }), ev({ id: '2', kind: 'ruck', matchTimeMs: 0 })];
    const { bins, maxMs } = eventHistogramByMatchTime(events, 6);
    expect(maxMs).toBe(0);
    expect(bins[0]).toBe(2);
  });
});
