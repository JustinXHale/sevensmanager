import { describe, expect, it } from 'vitest';
import type { MatchAnalyticsSnapshot } from './matchAnalytics';
import { triesByZone } from './matchStats';
import { aggregateTeamMatchSnapshots, tackleCompletionPct } from './teamGlobalStats';

const emptyTriesZ = triesByZone([]);

function snap(partial: Partial<MatchAnalyticsSnapshot> & Pick<MatchAnalyticsSnapshot, 'ownPoints' | 'oppPoints'>): MatchAnalyticsSnapshot {
  const base: MatchAnalyticsSnapshot = {
    ownPoints: partial.ownPoints,
    oppPoints: partial.oppPoints,
    ownTries: partial.ownTries ?? 0,
    oppTries: partial.oppTries ?? 0,
    ownKick: partial.ownKick ?? { made: 0, missed: 0, legacyNoOutcome: 0 },
    oppKick: partial.oppKick ?? { made: 0, missed: 0, legacyNoOutcome: 0 },
    tackles: partial.tackles ?? { made: 0, missed: 0 },
    subsOurs: partial.subsOurs ?? 0,
    subsOpp: partial.subsOpp ?? 0,
    cardsOurs: partial.cardsOurs ?? { yc: 0, rc: 0 },
    cardsOpp: partial.cardsOpp ?? { yc: 0, rc: 0 },
    territory: partial.territory ?? { defensive: 0, middle: 0, attack: 0, unzoned: 0 },
    triesZonedByZone: partial.triesZonedByZone ?? emptyTriesZ,
    scrums: partial.scrums ?? { won: 0, lost: 0, penalized: 0 },
    lineouts: partial.lineouts ?? { won: 0, lost: 0, penalized: 0 },
    rucks: partial.rucks ?? { won: 0, lost: 0, penalized: 0 },
  };
  return base;
}

describe('aggregateTeamMatchSnapshots', () => {
  it('sums metrics across games', () => {
    const agg = aggregateTeamMatchSnapshots([
      { eventCount: 10, snapshot: snap({ ownPoints: 12, oppPoints: 5, ownTries: 2, oppTries: 1, tackles: { made: 8, missed: 2 }, subsOurs: 1, subsOpp: 0 }) },
      { eventCount: 5, snapshot: snap({ ownPoints: 7, oppPoints: 14, ownTries: 1, oppTries: 2, tackles: { made: 3, missed: 1 }, subsOurs: 2, subsOpp: 1 }) },
    ]);
    expect(agg.gameCount).toBe(2);
    expect(agg.totalEvents).toBe(15);
    expect(agg.sumOwnPoints).toBe(19);
    expect(agg.sumOppPoints).toBe(19);
    expect(agg.tacklesMade).toBe(11);
    expect(agg.tacklesMissed).toBe(3);
    expect(agg.subsOurs).toBe(3);
    expect(agg.subsOpp).toBe(1);
  });
});

describe('tackleCompletionPct', () => {
  it('returns null when no tackles', () => {
    expect(tackleCompletionPct(0, 0)).toBeNull();
  });
});
