import { describe, expect, it } from 'vitest';
import type { MatchEventRecord } from './matchEvent';
import {
  computeMatchAnalyticsSnapshot,
  kickDecidedSuccessPct,
  ownTriesByTerritoryThird,
} from './matchAnalytics';

function ev(over: Partial<MatchEventRecord> & Pick<MatchEventRecord, 'id' | 'kind'>): MatchEventRecord {
  return {
    matchId: 'm1',
    matchTimeMs: 0,
    period: 1,
    createdAt: 0,
    ...over,
  } as MatchEventRecord;
}

describe('ownTriesByTerritoryThird', () => {
  it('buckets zoned tries and counts unzoned', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'try', playerId: 'a', zoneId: 'Z6' }),
      ev({ id: '2', kind: 'try', playerId: 'b', zoneId: 'Z2' }),
      ev({ id: '3', kind: 'try', playerId: 'c' }),
    ];
    expect(ownTriesByTerritoryThird(events)).toEqual({
      defensive: 1,
      middle: 0,
      attack: 1,
      unzoned: 1,
    });
  });
});

describe('kickDecidedSuccessPct', () => {
  it('returns null when no decided kicks', () => {
    expect(kickDecidedSuccessPct(0, 0)).toBeNull();
  });

  it('computes percentage', () => {
    expect(kickDecidedSuccessPct(3, 1)).toBe(75);
  });
});

describe('computeMatchAnalyticsSnapshot', () => {
  it('aggregates points and discipline', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'try', playerId: 'a' }),
      ev({ id: '2', kind: 'conversion', playerId: 'a', conversionOutcome: 'made' }),
      ev({ id: '3', kind: 'opponent_try' }),
      ev({ id: '4', kind: 'opponent_conversion', conversionOutcome: 'missed' }),
      ev({ id: '5', kind: 'opponent_substitution' }),
      ev({ id: '6', kind: 'team_penalty', playerId: 'a', penaltyCard: 'yellow' }),
      ev({ id: '7', kind: 'opponent_card', penaltyCard: 'red' }),
    ];
    const s = computeMatchAnalyticsSnapshot(events, 2);
    expect(s.ownPoints).toBe(5 + 2);
    expect(s.oppPoints).toBe(5 + 0);
    expect(s.subsOurs).toBe(2);
    expect(s.subsOpp).toBe(1);
    expect(s.cardsOurs.yc).toBe(1);
    expect(s.cardsOpp.rc).toBe(1);
  });

  it('counts set piece outcomes including rucks', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'scrum', setPieceOutcome: 'won' }),
      ev({ id: '2', kind: 'lineout', setPieceOutcome: 'lost' }),
      ev({ id: '3', kind: 'ruck', setPieceOutcome: 'penalized' }),
    ];
    const s = computeMatchAnalyticsSnapshot(events, 0);
    expect(s.scrums).toEqual({ won: 1, lost: 0, penalized: 0 });
    expect(s.lineouts).toEqual({ won: 0, lost: 1, penalized: 0 });
    expect(s.rucks).toEqual({ won: 0, lost: 0, penalized: 1 });
  });
});
